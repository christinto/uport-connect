import Web3 from "web3";
import { Connect } from "../src/index";

import Autosigner from "../utils/autosigner";
import testData from "./testData.json";
import ganache from "ganache-cli";

const addr1 = "0x9d00733ae37f34cdebe443e5cda8e9721fffa092";

describe("uportWeb3 integration tests", function() {
  jest.setTimeout(30000);

  let autosigner, status, vanillaWeb3, web3;
  const coolStatus = "Writing some tests!";

  beforeEach(done => {
    // global.navigator = {}

    // const testrpcProv = ganache.provider()
    const testrpcProv = new Web3.providers.HttpProvider(
      "http://localhost:8545"
    );

    vanillaWeb3 = new Web3(testrpcProv);
    // Create Autosigner
    Autosigner.load(testrpcProv, (err, as) => {
      if (err) {
        console.log("error loading autosigner");
        console.log(err);
        return done();
      }
      autosigner = as;
      vanillaWeb3.eth.getAccounts((err1, accounts) => {
        if (err1) {
          console.log(err1);
          return done();
        }
        // Create status contract
        const statusContractABI = vanillaWeb3.eth.contract(
          testData.statusContractAbiData
        );
        statusContractABI.new(
          {
            data: testData.statusContractBin,
            from: accounts[0],
            gas: 3000000
          },
          (err2, contract) => {
            if (err2) {
              console.log(err2);
              return done();
            }
            if (!contract.address) return;
            // console.log(contract)

            // Send ether to Autosigner
            vanillaWeb3.eth.sendTransaction(
              {
                from: accounts[0],
                to: autosigner.address,
                value: vanillaWeb3.toWei(90)
              },
              (err3, r) => {
                if (err3) {
                  console.log(err3);
                  return done();
                }
                // Change provider
                // Autosigner is a qrDisplay
                // that automatically signs transactions
                const uport = new Connect("Integration Tests", {
                  credentials: { settings: {}, address: autosigner.address },
                  provider: testrpcProv,
                  uriHandler: autosigner.openQr.bind(autosigner)
                });

                web3 = uport.getWeb3();
                console.log("web3 is defined!");
                status = web3.eth
                  .contract(testData.statusContractAbiData)
                  .at(contract.address);
                done();
              }
            );
          }
        );
      });
    });
  });

  it("getCoinbase", done => {
    web3.eth.getCoinbase((err, address) => {
      expect(err).toBeNull();
      expect(address).toEqual(autosigner.address);
      done();
    });
  });

  it("getAccounts", done => {
    web3.eth.getAccounts((err, addressList) => {
      expect(err).toBeNull();
      expect(addressList).toEqual([autosigner.address]);
      done();
    });
  });

  it("sendTransaction", done => {
    web3.eth.sendTransaction(
      { value: web3.toWei(2), to: addr1 },
      (err, txHash) => {
        expect(err).toBeNull();
        expect(txHash).toBeDefined();
        web3.eth.getBalance(addr1, (err, balance) => {
          expect(err).toBeNull();
          expect(balance.toString()).toEqual(web3.toWei(2));
          done();
        });
      }
    );
  });

  it("use contract", done => {
    status.updateStatus(coolStatus, (err, res) => {
      expect(err).toBeNull();
      if (err) {
        throw new Error(
          `Expected updateStatus to not return error: ${err.message}`
        );
      }
      expect(res).toBeDefined();
      web3.eth.getTransactionReceipt(res, (err, tx) => {
        expect(tx.blockNumber).toBeDefined();
        status.getStatus.call(autosigner.address, (err, myStatus) => {
          expect(err).toBeNull();
          expect(myStatus).toEqual(coolStatus);
          done();
        });
      });
    });
  });

  it("handles batches", done => {
    var batch = web3.createBatch();
    batch.add(
      web3.eth.getBalance.request(
        autosigner.address,
        "latest",
        (error, balance) => {
          expect(error).toBeNull();
          expect(parseInt(balance, 10)).toBeGreaterThan(0);
        }
      )
    );
    batch.add(
      web3.eth.getBalance.request(
        autosigner.address,
        "latest",
        (error, balance) => {
          expect(error).toBeNull();
          expect(balance).toBeGreaterThan(0);
        }
      )
    );
    batch.add(
      status.getStatus.request(autosigner.address, (error, myStatus) => {
        expect(error).toBeNull();
        expect(myStatus).toEqual(coolStatus);
      })
    );
    batch.execute();
    setTimeout(done, 1000);
  });

  it("does not handle sync calls", done => {
    expect(() => web3.eth.getBalance(autosigner.address)).toThrow(
      "Uport Web3 SubProvider does not support synchronous requests."
    );
    done();
  });
});
