const accountModel = require('../../models/accountModel'),
    blockModel = require('../../models/blockModel');


module.exports =  async function () {
    await accountModel.remove()
    await blockModel.find({hash: {$exists: true}}).remove()
};