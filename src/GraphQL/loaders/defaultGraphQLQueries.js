import {
  GraphQLNonNull,
  GraphQLBoolean,
  GraphQLString,
  GraphQLList,
  GraphQLID,
  GraphQLInt,
} from 'graphql';
import Parse from 'parse/node';
import * as defaultGraphQLTypes from './defaultGraphQLTypes';
import rest from '../../rest';

const HEALTH = {
  description:
    'The health query can be used to check if the server is up and running.',
  type: new GraphQLNonNull(GraphQLBoolean),
  resolve: () => true,
};

const GET = {
  description:
    'The get query can be used to get an object of a certain class by its objectId.',
  args: {
    className: {
      description: 'This is the class name of the objects to be found',
      type: new GraphQLNonNull(GraphQLString),
    },
    objectId: {
      description: 'The objectId that will be used to get the object.',
      type: new GraphQLNonNull(GraphQLID),
    },
    keys: {
      description: 'The keys of the object that will be returned',
      type: GraphQLString,
    },
    include: {
      description: 'The pointers of the object that will be returned',
      type: GraphQLString,
    },
    readPreference: {
      description: 'The read preference for the main query to be executed',
      type: defaultGraphQLTypes.READ_PREFERENCE,
    },
    includeReadPreference: {
      description:
        'The read preference for the queries to be executed to include fields',
      type: defaultGraphQLTypes.READ_PREFERENCE,
    },
  },
  type: new GraphQLNonNull(defaultGraphQLTypes.OBJECT),
  async resolve(_source, args, context) {
    const {
      className,
      objectId,
      keys,
      include,
      readPreference,
      includeReadPreference,
    } = args;

    const { config, auth, info } = context;

    const options = {};
    if (keys) {
      options.keys = keys;
    }
    if (include) {
      options.include = include;
    }
    if (readPreference) {
      options.readPreference = readPreference;
    }
    if (includeReadPreference) {
      options.includeReadPreference = includeReadPreference;
    }

    const response = await rest.get(
      config,
      auth,
      className,
      objectId,
      options,
      info.clientSDK
    );

    if (!response.results || response.results.length == 0) {
      throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, 'Object not found.');
    }

    if (className === '_User') {
      delete response.results[0].sessionToken;

      const user = response.results[0];

      if (auth.user && user.objectId == auth.user.id) {
        // Force the session token
        response.results[0].sessionToken = info.sessionToken;
      }
    }

    return response.results[0];
  },
};

const FIND = {
  description: 'The find query can be used to find objects of a certain class.',
  args: {
    className: {
      description: 'This is the class name of the objects to be found',
      type: new GraphQLNonNull(GraphQLString),
    },
    where: {
      description:
        'These are the conditions that the objects need to match in order to be found',
      type: defaultGraphQLTypes.OBJECT,
      defaultValue: {},
    },
    order: {
      description: 'This is the order in which the objects should be returned',
      type: GraphQLString,
    },
    skip: {
      description:
        'This is the number of objects that must be skipped to return',
      type: GraphQLInt,
    },
    limit: {
      description: 'This is the limit number of objects that must be returned',
      type: GraphQLInt,
    },
  },
  type: new GraphQLNonNull(new GraphQLList(defaultGraphQLTypes.OBJECT)),
  async resolve(_source, args, context) {
    const { className, where, order, skip, limit } = args;

    const { config, auth, info } = context;

    const options = {};
    if (order) {
      options.order = order;
    }
    if (skip) {
      options.skip = skip;
    }
    if (limit || limit === 0) {
      options.limit = limit;
    }
    if (config.maxLimit && options.limit > config.maxLimit) {
      // Silently replace the limit on the query with the max configured
      options.limit = config.maxLimit;
    }

    return (await rest.find(
      config,
      auth,
      className,
      where,
      options,
      info.clientSDK
    )).results;
  },
};

const load = parseGraphQLSchema => {
  parseGraphQLSchema.graphQLQueries.health = HEALTH;
  parseGraphQLSchema.graphQLQueries.get = GET;
  parseGraphQLSchema.graphQLQueries.find = FIND;
};

export { load };
