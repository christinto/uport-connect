const ganache = require("ganache-cli");
function globalSetup() {
  console.log("global setup!");

  let server = ganache.server();
  server.listen("8545", function(err, blockchain) {
    console.log("Node listening in port 8545");
    if (err) {
      console.log(err);
    }
  });
}
module.exports = globalSetup;
