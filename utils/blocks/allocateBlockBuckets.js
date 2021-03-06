/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Egor Zuev <zyev.egor@gmail.com>
 */

const _ = require('lodash'),
  bunyan = require('bunyan'),
  providerService = require('../../services/providerService'),
  Promise = require('bluebird'),
  config = require('../../config'),
  log = bunyan.createLogger({name: 'core.blockProcessor.utils.allocateBlockBuckets', level: config.logs.level}),
  models = require('../../models');

/**
 * @function
 * @description validate that all blocks in the specified range are exist in db
 * @param minBlock - validate from block
 * @param maxBlock - validate to block
 * @param chunkSize - the chunk validation size
 * @return {Promise<Array>}
 */
const blockValidator = async (minBlock, maxBlock, chunkSize) => {

  const data = [];

  const calculate = async (minBlock, maxBlock, chunkSize) => {
    let blocks = [];

    for (let blockNumber = minBlock; blockNumber <= maxBlock; blockNumber++)
      blocks.push(blockNumber);

    return await Promise.mapSeries(_.chunk(blocks, chunkSize), async (chunk) => {
      const minBlock = _.head(chunk);
      const maxBlock = _.last(chunk);
      log.info(`validating blocks from: ${minBlock} to ${maxBlock}`);
      const count = await models.blockModel.count({
        number: minBlock === maxBlock ? minBlock : {
          $gte: minBlock,
          $lt: maxBlock
        }
      });

      if (maxBlock !== minBlock && count !== maxBlock - minBlock && count)
        await calculate(minBlock, maxBlock, chunkSize / 10);

      if (!count)
        return data.push(minBlock === maxBlock ? [minBlock] : [minBlock, maxBlock]);

      return [];
    });
  };

  await calculate(minBlock, maxBlock, chunkSize);

  return data;
};

module.exports = async function () {

  let web3 = await providerService.get();

  let currentNodeHeight = await web3.eth.getBlockNumber().catch(() => -1);

  currentNodeHeight = parseInt(currentNodeHeight);

  if (currentNodeHeight === -1)
    return Promise.reject({code: 0});

  let missedBuckets = await blockValidator(0, currentNodeHeight - 2, 10000);
  missedBuckets = _.reverse(missedBuckets);

  return {
    missedBuckets: missedBuckets,
    height: currentNodeHeight === 0 ? currentNodeHeight : currentNodeHeight - 1
  };

};
