const http = require('http');
const express = require('express');
const req = require('../lib/request');
const fetch = require('node-fetch');
const ws = require('ws');
const { getMainDefinition } = require('apollo-utilities');
const { split } = require('apollo-link');
const { InMemoryCache } = require('apollo-cache-inmemory');
const { createUploadLink } = require('apollo-upload-client');
const { SubscriptionClient } = require('subscriptions-transport-ws');
const { WebSocketLink } = require('apollo-link-ws');
const ApolloClient = require('apollo-client').default;
const gql = require('graphql-tag');
const { ParseServer } = require('../');
const { ParseGraphQLServer } = require('../lib/GraphQL/ParseGraphQLServer');

describe('ParseGraphQLServer', () => {
  let parseServer;
  let parseGraphQLServer;

  beforeAll(async () => {
    parseServer = await global.reconfigureServer();
    parseGraphQLServer = new ParseGraphQLServer(parseServer, {
      graphQLPath: '/graphql',
      playgroundPath: '/playground',
      subscriptionsPath: '/subscriptions',
    });
  });

  describe('constructor', () => {
    it('should require a parseServer instance', () => {
      expect(() => new ParseGraphQLServer()).toThrow(
        'You must provide a parseServer instance!'
      );
    });

    it('should require config.graphQLPath', () => {
      expect(() => new ParseGraphQLServer(parseServer)).toThrow(
        'You must provide a config.graphQLPath!'
      );
      expect(() => new ParseGraphQLServer(parseServer, {})).toThrow(
        'You must provide a config.graphQLPath!'
      );
    });

    it('should only require parseServer and config.graphQLPath args', () => {
      let parseGraphQLServer;
      expect(() => {
        parseGraphQLServer = new ParseGraphQLServer(parseServer, {
          graphQLPath: 'graphql',
        });
      }).not.toThrow();
      expect(parseGraphQLServer.parseGraphQLSchema).toBeDefined();
      expect(parseGraphQLServer.parseGraphQLSchema.databaseController).toEqual(
        parseServer.config.databaseController
      );
    });
  });

  describe('_getGraphQLOptions', () => {
    const req = {
      info: new Object(),
      config: new Object(),
      auth: new Object(),
    };

    it("should return schema and context with req's info, config and auth", async () => {
      const options = await parseGraphQLServer._getGraphQLOptions(req);
      expect(options.schema).toEqual(
        parseGraphQLServer.parseGraphQLSchema.graphQLSchema
      );
      expect(options.context.info).toEqual(req.info);
      expect(options.context.config).toEqual(req.config);
      expect(options.context.auth).toEqual(req.auth);
    });

    it('should load GraphQL schema in every call', async () => {
      const originalLoad = parseGraphQLServer.parseGraphQLSchema.load;
      let counter = 0;
      parseGraphQLServer.parseGraphQLSchema.load = () => ++counter;
      expect((await parseGraphQLServer._getGraphQLOptions(req)).schema).toEqual(
        1
      );
      expect((await parseGraphQLServer._getGraphQLOptions(req)).schema).toEqual(
        2
      );
      expect((await parseGraphQLServer._getGraphQLOptions(req)).schema).toEqual(
        3
      );
      parseGraphQLServer.parseGraphQLSchema.load = originalLoad;
    });
  });

  describe('API', () => {
    let apolloClient;

    beforeAll(async () => {
      const expressApp = express();
      const httpServer = http.createServer(expressApp);
      expressApp.use('/parse', parseServer.app);
      ParseServer.createLiveQueryServer(httpServer, {
        port: 1338,
      });
      parseGraphQLServer.applyGraphQL(expressApp);
      parseGraphQLServer.applyPlayground(expressApp);
      parseGraphQLServer.createSubscriptions(httpServer);
      await new Promise(resolve => httpServer.listen({ port: 13377 }, resolve));

      const headers = {
        'X-Parse-Application-Id': 'test',
        'X-Parse-Javascript-Key': 'test',
      };
      const subscriptionClient = new SubscriptionClient(
        'ws://localhost:13377/subscriptions',
        {
          reconnect: true,
          connectionParams: headers,
        },
        ws
      );
      const wsLink = new WebSocketLink(subscriptionClient);
      const httpLink = createUploadLink({
        uri: 'http://localhost:13377/graphql',
        fetch,
        headers,
      });
      apolloClient = new ApolloClient({
        link: split(
          ({ query }) => {
            const { kind, operation } = getMainDefinition(query);
            return (
              kind === 'OperationDefinition' && operation === 'subscription'
            );
          },
          wsLink,
          httpLink
        ),
        cache: new InMemoryCache(),
      });
    });

    it('should be healthy', async () => {
      const health = (await apolloClient.query({
        query: gql`
          query Health {
            health
          }
        `,
        fetchPolicy: 'no-cache',
      })).data.health;
      expect(health).toBeTruthy();
    });

    it('should mount playground', async () => {
      const res = await req({
        method: 'GET',
        url: 'http://localhost:13377/playground',
      });
      expect(res.status).toEqual(200);
    });
  });
});
