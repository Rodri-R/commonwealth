/**
 * This script "migrates" chain entities (proposals) from the chain into the database, by first
 * querying events, and then attempting to fetch corresponding entities
 * from the chain, writing the results back into the database.
 */

import _ from 'underscore';
import {
  SubstrateEvents,
  IStorageFetcher,
  CompoundEvents,
  AaveEvents,
  IDisconnectedRange,
} from '@commonwealth/chain-events';

import models from '../database';
import MigrationHandler from '../eventHandlers/migration';
import EntityArchivalHandler from '../eventHandlers/entityArchival';
import { ChainNodeInstance } from '../models/chain_node';
import { ChainBase, ChainNetwork } from '../../shared/types';
import { factory, formatFilename } from '../../shared/logging';
import { constructSubstrateUrl } from '../../shared/substrate';

const log = factory.getLogger(formatFilename(__filename));

const ENTITY_MIGRATION = process.env.ENTITY_MIGRATION;

export async function migrateChainEntity(chain: string): Promise<void> {
  // 1. fetch the node and url of supported/selected chains
  log.info(`Fetching node info for ${chain}...`);
  if (!chain) {
    throw new Error('must provide chain');
  }

  // query one node for each supported chain
  const node: ChainNodeInstance = await models['ChainNode'].findOne({
    where: { chain },
    include: {
      model: models.Chain,
      required: true,
    },
  });
  if (!node) {
    throw new Error('no nodes found for chain entity migration');
  }

  // 2. for each node, fetch and migrate chain entities
  log.info(`Fetching and migrating chain entities for: ${chain}`);
  try {
    const migrationHandler = new MigrationHandler(models, chain);
    const entityArchivalHandler = new EntityArchivalHandler(models, chain);
    let fetcher: IStorageFetcher<any>;
    const range: IDisconnectedRange = { startBlock: 0 };
    if (node.Chain.base === ChainBase.Substrate) {
      const nodeUrl = constructSubstrateUrl(node.url);
      const api = await SubstrateEvents.createApi(
        nodeUrl,
        node.Chain.substrate_spec
      );
      fetcher = new SubstrateEvents.StorageFetcher(api);
    } else if (node.Chain.network === ChainNetwork.Moloch) {
      // TODO: determine moloch API version
      // TODO: construct dater
      throw new Error('Moloch migration not yet implemented.');
    } else if (node.Chain.network === ChainNetwork.Compound) {
      const api = await CompoundEvents.createApi(node.url, node.address);
      fetcher = new CompoundEvents.StorageFetcher(api);
      range.startBlock = 0;
    } else if (node.Chain.network === ChainNetwork.Aave) {
      const api = await AaveEvents.createApi(node.url, node.address);
      fetcher = new AaveEvents.StorageFetcher(api);
      range.startBlock = 0;
    } else {
      throw new Error('Unsupported migration chain');
    }

    log.info('Fetching chain events...');
    const events = await fetcher.fetch(range, true);
    events.sort((a, b) => a.blockNumber - b.blockNumber);
    log.info(`Writing chain events to db... (count: ${events.length})`);
    for (const event of events) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const dbEvent = await migrationHandler.handle(event);
        await entityArchivalHandler.handle(event, dbEvent);
      } catch (e) {
        log.error(`Event handle failure: ${e.message}`);
      }
    }
  } catch (e) {
    log.error(`Failed to fetch events for ${chain}: ${e.message}`);
  }
}

export async function migrateChainEntities(): Promise<void> {
  const chains = await models.Chain.findAll({
    where: {
      active: true,
      has_chain_events_listener: true,
    },
  });
  for (const { id } of chains) {
    await migrateChainEntity(id);
  }
}

async function main() {
  // "all" means run for all supported chains, otherwise we pass in the name of
  // the specific chain to migrate
  log.info('Started migrating chain entities into the DB');
  try {
    await (ENTITY_MIGRATION === 'all'
      ? migrateChainEntities()
      : migrateChainEntity(ENTITY_MIGRATION));
    log.info('Finished migrating chain entities into the DB');
    process.exit(0);
  } catch (e) {
    log.error('Failed migrating chain entities into the DB: ', e.message);
    process.exit(1);
  }
}

main();
