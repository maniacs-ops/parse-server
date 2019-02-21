import { ParseMessageQueue }      from '../ParseMessageQueue';
import rest                       from '../rest';
import { applyDeviceTokenExists, getIdInterval } from './utils';
import Parse from 'parse/node';
import log from '../logger';

const PUSH_CHANNEL = 'parse-server-push';
const DEFAULT_BATCH_SIZE = 100;

export class PushQueue {
  parsePublisher: Object;
  channel: String;
  batchSize: Number;

  // config object of the publisher, right now it only contains the redisURL,
  // but we may extend it later.
  constructor(config: any = {}) {
    this.channel = config.channel || PushQueue.defaultPushChannel();
    this.batchSize = config.batchSize || DEFAULT_BATCH_SIZE;
    this.parsePublisher = ParseMessageQueue.createPublisher(config);
  }

  static defaultPushChannel() {
    return `${Parse.applicationId}-${PUSH_CHANNEL}`;
  }

  enqueue(body, where, config, auth, pushStatus) {
    const limit = this.batchSize;

    where = applyDeviceTokenExists(where);

    // Order by objectId so no impact on the DB
    // const order = 'objectId';
    return Promise.resolve().then(() => {
      return rest.find(config,
        auth,
        '_Installation',
        where,
        {limit: 0, count: true});
    }).then(({results, count}) => {
      if (!results || count == 0) {
        return pushStatus.complete();
      }
      const maxPages = Math.ceil(count / limit)
      pushStatus.setRunning(maxPages);
      let skip = 0, page = 0;
      const promises = []
      while (skip < count) {
        const _id = getIdInterval(page, maxPages)
        if (_id) where.objectId = _id
        const query = { where };
        // const query = { where,
        //   limit,
        //   skip,
        //   order };

        const pushWorkItem = {
          body,
          query,
          pushStatus: { objectId: pushStatus.objectId },
          applicationId: config.applicationId
        }
        const promise = Promise.resolve(this.parsePublisher.publish(this.channel, JSON.stringify(pushWorkItem))).catch(err => {
          log.error(err.message)
          log.error(err.stack)
          return err
        })
        promises.push(promise);
        skip += limit;
        page ++;
      }
      // if some errors occurs set running to maxPages - errors.length
      return Promise.all(promises).then(results => {
        const errors = results.filter(r => r instanceof Error)
        if (errors.length) {
          pushStatus.setRunning(maxPages - errors.length);
        }
      });
    });
  }
}
