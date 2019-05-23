const http = require('http');
const express = require('express');
const req = require('../lib/request');
const fetch = require('node-fetch');
const ws = require('ws');
const { getMainDefinition } = require('apollo-utilities');
const { ApolloLink, split } = require('apollo-link');
const { createHttpLink } = require('apollo-link-http');
const { InMemoryCache } = require('apollo-cache-inmemory');
const { createUploadLink } = require('apollo-upload-client');
const { SubscriptionClient } = require('subscriptions-transport-ws');
const { WebSocketLink } = require('apollo-link-ws');
const ApolloClient = require('apollo-client').default;
const gql = require('graphql-tag');
const { ParseServer } = require('../');
const { ParseGraphQLServer } = require('../lib/GraphQL/ParseGraphQLServer');
const ReadPreference = require('mongodb').ReadPreference;

describe('ParseGraphQLServer', () => {
  let parseServer;
  let parseGraphQLServer;

  beforeAll(async () => {
    parseServer = await global.reconfigureServer({
      maxLimit: 10,
    });
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

    it('should initialize parseGraphQLSchema with a log controller', async () => {
      const loggerAdapter = {
        log: () => {},
        error: () => {},
      };
      const parseServer = await reconfigureServer({
        loggerAdapter,
      });
      const parseGraphQLServer = new ParseGraphQLServer(parseServer, {
        graphQLPath: 'graphql',
      });
      expect(parseGraphQLServer.parseGraphQLSchema.log.adapter).toBe(
        loggerAdapter
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

  describe('applyGraphQL', () => {
    it('should require an Express.js app instance', () => {
      expect(() => parseGraphQLServer.applyGraphQL()).toThrow(
        'You must provide an Express.js app instance!'
      );
      expect(() => parseGraphQLServer.applyGraphQL({})).toThrow(
        'You must provide an Express.js app instance!'
      );
      expect(() =>
        parseGraphQLServer.applyGraphQL(new express())
      ).not.toThrow();
    });

    it('should apply middlewares at config.graphQLPath', () => {
      let useCount = 0;
      expect(() =>
        new ParseGraphQLServer(parseServer, {
          graphQLPath: 'somepath',
        }).applyGraphQL({
          use: path => {
            useCount++;
            expect(path).toEqual('somepath');
          },
        })
      ).not.toThrow();
      expect(useCount).toBeGreaterThan(0);
    });
  });

  describe('applyPlayground', () => {
    it('should require an Express.js app instance', () => {
      expect(() => parseGraphQLServer.applyPlayground()).toThrow(
        'You must provide an Express.js app instance!'
      );
      expect(() => parseGraphQLServer.applyPlayground({})).toThrow(
        'You must provide an Express.js app instance!'
      );
      expect(() =>
        parseGraphQLServer.applyPlayground(new express())
      ).not.toThrow();
    });

    it('should require initialization with config.playgroundPath', () => {
      expect(() =>
        new ParseGraphQLServer(parseServer, {
          graphQLPath: 'graphql',
        }).applyPlayground(new express())
      ).toThrow('You must provide a config.playgroundPath to applyPlayground!');
    });

    it('should apply middlewares at config.playgroundPath', () => {
      let useCount = 0;
      expect(() =>
        new ParseGraphQLServer(parseServer, {
          graphQLPath: 'graphQL',
          playgroundPath: 'somepath',
        }).applyPlayground({
          get: path => {
            useCount++;
            expect(path).toEqual('somepath');
          },
        })
      ).not.toThrow();
      expect(useCount).toBeGreaterThan(0);
    });
  });

  describe('createSubscriptions', () => {
    it('should require initialization with config.subscriptionsPath', () => {
      expect(() =>
        new ParseGraphQLServer(parseServer, {
          graphQLPath: 'graphql',
        }).createSubscriptions({})
      ).toThrow(
        'You must provide a config.subscriptionsPath to createSubscriptions!'
      );
    });
  });

  describe('API', () => {
    const headers = {
      'X-Parse-Application-Id': 'test',
      'X-Parse-Javascript-Key': 'test',
    };

    let apolloClient;

    let user1;
    let user2;
    let user3;
    let user4;
    let user5;
    let role;
    let object1;
    let object2;
    let object3;
    let object4;
    const objects = [];

    async function prepareData() {
      user1 = new Parse.User();
      user1.setUsername('user1');
      user1.setPassword('user1');
      await user1.signUp();

      user2 = new Parse.User();
      user2.setUsername('user2');
      user2.setPassword('user2');
      await user2.signUp();

      user3 = new Parse.User();
      user3.setUsername('user3');
      user3.setPassword('user3');
      await user3.signUp();

      user4 = new Parse.User();
      user4.setUsername('user4');
      user4.setPassword('user4');
      await user4.signUp();

      user5 = new Parse.User();
      user5.setUsername('user5');
      user5.setPassword('user5');
      await user5.signUp();

      const roleACL = new Parse.ACL();
      roleACL.setPublicReadAccess(true);
      role = new Parse.Role();
      role.setName('role');
      role.setACL(roleACL);
      role.getUsers().add(user1);
      role.getUsers().add(user3);
      role = await role.save();

      const schemaController = await parseServer.config.databaseController.loadSchema();
      await schemaController.addClassIfNotExists(
        'GraphQLClass',
        {
          someField: { type: 'String' },
          pointerToUser: { type: 'Pointer', targetClass: '_User' },
        },
        {
          find: {
            'role:role': true,
            [user1.id]: true,
            [user2.id]: true,
          },
          create: {
            'role:role': true,
            [user1.id]: true,
            [user2.id]: true,
          },
          get: {
            'role:role': true,
            [user1.id]: true,
            [user2.id]: true,
          },
          update: {
            'role:role': true,
            [user1.id]: true,
            [user2.id]: true,
          },
          addField: {
            'role:role': true,
            [user1.id]: true,
            [user2.id]: true,
          },
          delete: {
            'role:role': true,
            [user1.id]: true,
            [user2.id]: true,
          },
          readUserFields: ['pointerToUser'],
          writeUserFields: ['pointerToUser'],
        },
        {}
      );

      object1 = new Parse.Object('GraphQLClass');
      object1.set('someField', 'someValue1');
      const object1ACL = new Parse.ACL();
      object1ACL.setPublicReadAccess(false);
      object1ACL.setPublicWriteAccess(false);
      object1ACL.setRoleReadAccess(role, true);
      object1ACL.setRoleWriteAccess(role, true);
      object1ACL.setReadAccess(user1.id, true);
      object1ACL.setWriteAccess(user1.id, true);
      object1ACL.setReadAccess(user2.id, true);
      object1ACL.setWriteAccess(user2.id, true);
      object1.setACL(object1ACL);
      await object1.save(undefined, { useMasterKey: true });

      object2 = new Parse.Object('GraphQLClass');
      object2.set('someField', 'someValue2');
      const object2ACL = new Parse.ACL();
      object2ACL.setPublicReadAccess(false);
      object2ACL.setPublicWriteAccess(false);
      object2ACL.setReadAccess(user1.id, true);
      object2ACL.setWriteAccess(user1.id, true);
      object2ACL.setReadAccess(user2.id, true);
      object2ACL.setWriteAccess(user2.id, true);
      object2ACL.setReadAccess(user5.id, true);
      object2ACL.setWriteAccess(user5.id, true);
      object2.setACL(object2ACL);
      await object2.save(undefined, { useMasterKey: true });

      object3 = new Parse.Object('GraphQLClass');
      object3.set('someField', 'someValue3');
      object3.set('pointerToUser', user5);
      await object3.save(undefined, { useMasterKey: true });

      object4 = new Parse.Object('PublicClass');
      object4.set('someField', 'someValue4');
      await object4.save();

      objects.push(object1, object2, object3, object4);
    }

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
        defaultOptions: {
          query: {
            fetchPolicy: 'no-cache',
          },
        },
      });
    });

    describe('GraphQL', () => {
      it('should be healthy', async () => {
        const health = (await apolloClient.query({
          query: gql`
            query Health {
              health
            }
          `,
        })).data.health;
        expect(health).toBeTruthy();
      });

      it('should be cors enabled', async () => {
        let checked = false;
        const apolloClient = new ApolloClient({
          link: new ApolloLink((operation, forward) => {
            return forward(operation).map(response => {
              const context = operation.getContext();
              const {
                response: { headers },
              } = context;
              expect(headers.get('access-control-allow-origin')).toEqual('*');
              checked = true;
              return response;
            });
          }).concat(
            createHttpLink({
              uri: 'http://localhost:13377/graphql',
              fetch,
              headers: {
                ...headers,
                Origin: 'http://someorigin.com',
              },
            })
          ),
          cache: new InMemoryCache(),
        });
        const healthResponse = await apolloClient.query({
          query: gql`
            query Health {
              health
            }
          `,
        });
        expect(healthResponse.data.health).toBeTruthy();
        expect(checked).toBeTruthy();
      });

      it('should handle Parse headers', async () => {
        let checked = false;
        const originalGetGraphQLOptions = parseGraphQLServer._getGraphQLOptions;
        parseGraphQLServer._getGraphQLOptions = async req => {
          expect(req.info).toBeDefined();
          expect(req.config).toBeDefined();
          expect(req.auth).toBeDefined();
          checked = true;
          return await originalGetGraphQLOptions.bind(parseGraphQLServer)(req);
        };
        const health = (await apolloClient.query({
          query: gql`
            query Health {
              health
            }
          `,
        })).data.health;
        expect(health).toBeTruthy();
        expect(checked).toBeTruthy();
        parseGraphQLServer._getGraphQLOptions = originalGetGraphQLOptions;
      });
    });

    describe('Playground', () => {
      it('should mount playground', async () => {
        const res = await req({
          method: 'GET',
          url: 'http://localhost:13377/playground',
        });
        expect(res.status).toEqual(200);
      });
    });

    describe('Schema', () => {
      describe('Default Types', () => {
        it('should have Object scalar type', async () => {
          const objectType = (await apolloClient.query({
            query: gql`
              query ObjectType {
                __type(name: "Object") {
                  kind
                }
              }
            `,
          })).data['__type'];
          expect(objectType.kind).toEqual('SCALAR');
        });

        it('should have Date scalar type', async () => {
          const dateType = (await apolloClient.query({
            query: gql`
              query DateType {
                __type(name: "Date") {
                  kind
                }
              }
            `,
          })).data['__type'];
          expect(dateType.kind).toEqual('SCALAR');
        });

        it('should have File object type', async () => {
          const fileType = (await apolloClient.query({
            query: gql`
              query FileType {
                __type(name: "File") {
                  kind
                  fields {
                    name
                  }
                }
              }
            `,
          })).data['__type'];
          expect(fileType.kind).toEqual('OBJECT');
          expect(fileType.fields.map(field => field.name).sort()).toEqual([
            'name',
            'url',
          ]);
        });

        it('should have CreateResult object type', async () => {
          const createResultType = (await apolloClient.query({
            query: gql`
              query CreateResultType {
                __type(name: "CreateResult") {
                  kind
                  fields {
                    name
                  }
                }
              }
            `,
          })).data['__type'];
          expect(createResultType.kind).toEqual('OBJECT');
          expect(
            createResultType.fields.map(field => field.name).sort()
          ).toEqual(['createdAt', 'objectId']);
        });

        it('should have Class interface type', async () => {
          const classType = (await apolloClient.query({
            query: gql`
              query ClassType {
                __type(name: "Class") {
                  kind
                  fields {
                    name
                  }
                }
              }
            `,
          })).data['__type'];
          expect(classType.kind).toEqual('INTERFACE');
          expect(classType.fields.map(field => field.name).sort()).toEqual([
            'ACL',
            'createdAt',
            'objectId',
            'updatedAt',
          ]);
        });

        it('should have ReadPreference enum type', async () => {
          const readPreferenceType = (await apolloClient.query({
            query: gql`
              query ReadPreferenceType {
                __type(name: "ReadPreference") {
                  kind
                  enumValues {
                    name
                  }
                }
              }
            `,
          })).data['__type'];
          expect(readPreferenceType.kind).toEqual('ENUM');
          expect(
            readPreferenceType.enumValues.map(value => value.name).sort()
          ).toEqual([
            'NEAREST',
            'PRIMARY',
            'PRIMARY_PREFERRED',
            'SECONDARY',
            'SECONDARY_PREFERRED',
          ]);
        });

        it('should have FindResult object type', async () => {
          const findResultType = (await apolloClient.query({
            query: gql`
              query FindResultType {
                __type(name: "FindResult") {
                  kind
                  fields {
                    name
                  }
                }
              }
            `,
          })).data['__type'];
          expect(findResultType.kind).toEqual('OBJECT');
          expect(findResultType.fields.map(name => name.name).sort()).toEqual([
            'count',
            'results',
          ]);
        });
      });

      describe('Default Queries', () => {
        describe('Get', () => {
          it('should return a class object', async () => {
            const obj = new Parse.Object('SomeClass');
            obj.set('someField', 'someValue');
            await obj.save();

            const result = (await apolloClient.query({
              query: gql`
                query GetSomeObject($objectId: ID!) {
                  get(className: "SomeClass", objectId: $objectId)
                }
              `,
              variables: {
                objectId: obj.id,
              },
            })).data.get;

            expect(result.objectId).toEqual(obj.id);
            expect(result.someField).toEqual('someValue');
            expect(new Date(result.createdAt)).toEqual(obj.createdAt);
            expect(new Date(result.updatedAt)).toEqual(obj.updatedAt);
          });

          it('should respect level permissions', async () => {
            await prepareData();

            function getObject(className, objectId, headers) {
              return apolloClient.query({
                query: gql`
                  query GetSomeObject($className: String!, $objectId: ID!) {
                    get(className: $className, objectId: $objectId)
                  }
                `,
                variables: {
                  className,
                  objectId,
                },
                context: {
                  headers,
                },
              });
            }

            await Promise.all(
              objects
                .slice(0, 3)
                .map(obj =>
                  expectAsync(
                    getObject(obj.className, obj.id)
                  ).toBeRejectedWith(jasmine.stringMatching('Object not found'))
                )
            );
            expect(
              (await getObject(object4.className, object4.id)).data.get
                .someField
            ).toEqual('someValue4');
            await Promise.all(
              objects.map(async obj =>
                expect(
                  (await getObject(obj.className, obj.id, {
                    'X-Parse-Master-Key': 'test',
                  })).data.get.someField
                ).toEqual(obj.get('someField'))
              )
            );
            await Promise.all(
              objects.map(async obj =>
                expect(
                  (await getObject(obj.className, obj.id, {
                    'X-Parse-Session-Token': user1.getSessionToken(),
                  })).data.get.someField
                ).toEqual(obj.get('someField'))
              )
            );
            await Promise.all(
              objects.map(async obj =>
                expect(
                  (await getObject(obj.className, obj.id, {
                    'X-Parse-Session-Token': user2.getSessionToken(),
                  })).data.get.someField
                ).toEqual(obj.get('someField'))
              )
            );
            await expectAsync(
              getObject(object2.className, object2.id, {
                'X-Parse-Session-Token': user3.getSessionToken(),
              })
            ).toBeRejectedWith(jasmine.stringMatching('Object not found'));
            await Promise.all(
              [object1, object3, object4].map(async obj =>
                expect(
                  (await getObject(obj.className, obj.id, {
                    'X-Parse-Session-Token': user3.getSessionToken(),
                  })).data.get.someField
                ).toEqual(obj.get('someField'))
              )
            );
            await Promise.all(
              objects.slice(0, 3).map(obj =>
                expectAsync(
                  getObject(obj.className, obj.id, {
                    'X-Parse-Session-Token': user4.getSessionToken(),
                  })
                ).toBeRejectedWith(jasmine.stringMatching('Object not found'))
              )
            );
            expect(
              (await getObject(object4.className, object4.id, {
                'X-Parse-Session-Token': user4.getSessionToken(),
              })).data.get.someField
            ).toEqual('someValue4');
            await Promise.all(
              objects.slice(0, 2).map(obj =>
                expectAsync(
                  getObject(obj.className, obj.id, {
                    'X-Parse-Session-Token': user5.getSessionToken(),
                  })
                ).toBeRejectedWith(jasmine.stringMatching('Object not found'))
              )
            );
            expect(
              (await getObject(object3.className, object3.id, {
                'X-Parse-Session-Token': user5.getSessionToken(),
              })).data.get.someField
            ).toEqual('someValue3');
            expect(
              (await getObject(object4.className, object4.id, {
                'X-Parse-Session-Token': user5.getSessionToken(),
              })).data.get.someField
            ).toEqual('someValue4');
          });

          it('should not bring session token of another user', async () => {
            await prepareData();

            const result = await apolloClient.query({
              query: gql`
                query GetSomeObject($objectId: ID!) {
                  get(className: "_User", objectId: $objectId)
                }
              `,
              variables: {
                objectId: user2.id,
              },
              context: {
                headers: {
                  'X-Parse-Session-Token': user1.getSessionToken(),
                },
              },
            });
            expect(result.data.get.sessionToken).toBeUndefined();
          });

          it('should bring session token of current user', async () => {
            await prepareData();

            const result = await apolloClient.query({
              query: gql`
                query GetSomeObject($objectId: ID!) {
                  get(className: "_User", objectId: $objectId)
                }
              `,
              variables: {
                objectId: user1.id,
              },
              context: {
                headers: {
                  'X-Parse-Session-Token': user1.getSessionToken(),
                },
              },
            });
            expect(result.data.get.sessionToken).toBeDefined();
          });

          it('should support keys argument', async () => {
            await prepareData();

            const result1 = await apolloClient.query({
              query: gql`
                query GetSomeObject($objectId: ID!) {
                  get(
                    className: "GraphQLClass"
                    objectId: $objectId
                    keys: "someField"
                  )
                }
              `,
              variables: {
                objectId: object3.id,
              },
              context: {
                headers: {
                  'X-Parse-Session-Token': user1.getSessionToken(),
                },
              },
            });

            const result2 = await apolloClient.query({
              query: gql`
                query GetSomeObject($objectId: ID!) {
                  get(
                    className: "GraphQLClass"
                    objectId: $objectId
                    keys: "someField,pointerToUser"
                  )
                }
              `,
              variables: {
                objectId: object3.id,
              },
              context: {
                headers: {
                  'X-Parse-Session-Token': user1.getSessionToken(),
                },
              },
            });

            expect(result1.data.get.someField).toBeDefined();
            expect(result1.data.get.pointerToUser).toBeUndefined();
            expect(result2.data.get.someField).toBeDefined();
            expect(result2.data.get.pointerToUser).toBeDefined();
          });

          it('should support include argument', async () => {
            await prepareData();

            const result1 = await apolloClient.query({
              query: gql`
                query GetSomeObject($objectId: ID!) {
                  get(className: "GraphQLClass", objectId: $objectId)
                }
              `,
              variables: {
                objectId: object3.id,
              },
              context: {
                headers: {
                  'X-Parse-Session-Token': user1.getSessionToken(),
                },
              },
            });

            const result2 = await apolloClient.query({
              query: gql`
                query GetSomeObject($objectId: ID!) {
                  get(
                    className: "GraphQLClass"
                    objectId: $objectId
                    include: "pointerToUser"
                  )
                }
              `,
              variables: {
                objectId: object3.id,
              },
              context: {
                headers: {
                  'X-Parse-Session-Token': user1.getSessionToken(),
                },
              },
            });

            expect(result1.data.get.pointerToUser.username).toBeUndefined();
            expect(result2.data.get.pointerToUser.username).toBeDefined();
          });

          describe_only_db('mongo')('read preferences', () => {
            it('should read from primary by default', async () => {
              await prepareData();

              const databaseAdapter =
                parseServer.config.databaseController.adapter;
              spyOn(
                databaseAdapter.database.serverConfig,
                'cursor'
              ).and.callThrough();

              await apolloClient.query({
                query: gql`
                  query GetSomeObject($objectId: ID!) {
                    get(
                      className: "GraphQLClass"
                      objectId: $objectId
                      include: "pointerToUser"
                    )
                  }
                `,
                variables: {
                  objectId: object3.id,
                },
                context: {
                  headers: {
                    'X-Parse-Session-Token': user1.getSessionToken(),
                  },
                },
              });

              let foundGraphQLClassReadPreference = false;
              let foundUserClassReadPreference = false;
              databaseAdapter.database.serverConfig.cursor.calls
                .all()
                .forEach(call => {
                  if (call.args[0].indexOf('GraphQLClass') >= 0) {
                    foundGraphQLClassReadPreference = true;
                    expect(call.args[2].readPreference).toBe(null);
                  } else if (call.args[0].indexOf('_User') >= 0) {
                    foundUserClassReadPreference = true;
                    expect(call.args[2].readPreference).toBe(null);
                  }
                });

              expect(foundGraphQLClassReadPreference).toBe(true);
              expect(foundUserClassReadPreference).toBe(true);
            });

            it('should support readPreference argument', async () => {
              await prepareData();

              const databaseAdapter =
                parseServer.config.databaseController.adapter;
              spyOn(
                databaseAdapter.database.serverConfig,
                'cursor'
              ).and.callThrough();

              await apolloClient.query({
                query: gql`
                  query GetSomeObject($objectId: ID!) {
                    get(
                      className: "GraphQLClass"
                      objectId: $objectId
                      include: "pointerToUser"
                      readPreference: SECONDARY
                    )
                  }
                `,
                variables: {
                  objectId: object3.id,
                },
                context: {
                  headers: {
                    'X-Parse-Master-Key': 'test',
                  },
                },
              });

              let foundGraphQLClassReadPreference = false;
              let foundUserClassReadPreference = false;
              databaseAdapter.database.serverConfig.cursor.calls
                .all()
                .forEach(call => {
                  if (call.args[0].indexOf('GraphQLClass') >= 0) {
                    foundGraphQLClassReadPreference = true;
                    expect(call.args[2].readPreference.preference).toBe(
                      ReadPreference.SECONDARY
                    );
                  } else if (call.args[0].indexOf('_User') >= 0) {
                    foundUserClassReadPreference = true;
                    expect(call.args[2].readPreference.preference).toBe(
                      ReadPreference.SECONDARY
                    );
                  }
                });

              expect(foundGraphQLClassReadPreference).toBe(true);
              expect(foundUserClassReadPreference).toBe(true);
            });

            it('should support includeReadPreference argument', async () => {
              await prepareData();

              const databaseAdapter =
                parseServer.config.databaseController.adapter;
              spyOn(
                databaseAdapter.database.serverConfig,
                'cursor'
              ).and.callThrough();

              await apolloClient.query({
                query: gql`
                  query GetSomeObject($objectId: ID!) {
                    get(
                      className: "GraphQLClass"
                      objectId: $objectId
                      include: "pointerToUser"
                      readPreference: SECONDARY
                      includeReadPreference: NEAREST
                    )
                  }
                `,
                variables: {
                  objectId: object3.id,
                },
                context: {
                  headers: {
                    'X-Parse-Master-Key': 'test',
                  },
                },
              });

              let foundGraphQLClassReadPreference = false;
              let foundUserClassReadPreference = false;
              databaseAdapter.database.serverConfig.cursor.calls
                .all()
                .forEach(call => {
                  if (call.args[0].indexOf('GraphQLClass') >= 0) {
                    foundGraphQLClassReadPreference = true;
                    expect(call.args[2].readPreference.preference).toBe(
                      ReadPreference.SECONDARY
                    );
                  } else if (call.args[0].indexOf('_User') >= 0) {
                    foundUserClassReadPreference = true;
                    expect(call.args[2].readPreference.preference).toBe(
                      ReadPreference.NEAREST
                    );
                  }
                });

              expect(foundGraphQLClassReadPreference).toBe(true);
              expect(foundUserClassReadPreference).toBe(true);
            });
          });
        });

        describe('Find', () => {
          it('should return class objects', async () => {
            const obj1 = new Parse.Object('SomeClass');
            obj1.set('someField', 'someValue1');
            await obj1.save();
            const obj2 = new Parse.Object('SomeClass');
            obj2.set('someField', 'someValue1');
            await obj2.save();

            const result = await apolloClient.query({
              query: gql`
                query FindSomeObjects {
                  find(className: "SomeClass") {
                    results
                  }
                }
              `,
            });

            result.data.find.results.forEach(resultObj => {
              const obj = resultObj.objectId === obj1.id ? obj1 : obj2;
              expect(resultObj.objectId).toEqual(obj.id);
              expect(resultObj.someField).toEqual(obj.get('someField'));
              expect(new Date(resultObj.createdAt)).toEqual(obj.createdAt);
              expect(new Date(resultObj.updatedAt)).toEqual(obj.updatedAt);
            });
          });

          it('should respect level permissions', async () => {
            await prepareData();

            function findObjects(className, headers) {
              return apolloClient.query({
                query: gql`
                  query FindSomeObjects($className: String!) {
                    find(className: $className) {
                      results
                    }
                  }
                `,
                variables: {
                  className,
                },
                context: {
                  headers,
                },
              });
            }

            expect(
              (await findObjects('GraphQLClass')).data.find.results.map(
                object => object.someField
              )
            ).toEqual([]);
            expect(
              (await findObjects('PublicClass')).data.find.results.map(
                object => object.someField
              )
            ).toEqual(['someValue4']);
            expect(
              (await findObjects('GraphQLClass', {
                'X-Parse-Master-Key': 'test',
              })).data.find.results
                .map(object => object.someField)
                .sort()
            ).toEqual(['someValue1', 'someValue2', 'someValue3']);
            expect(
              (await findObjects('PublicClass', {
                'X-Parse-Master-Key': 'test',
              })).data.find.results.map(object => object.someField)
            ).toEqual(['someValue4']);
            expect(
              (await findObjects('GraphQLClass', {
                'X-Parse-Session-Token': user1.getSessionToken(),
              })).data.find.results
                .map(object => object.someField)
                .sort()
            ).toEqual(['someValue1', 'someValue2', 'someValue3']);
            expect(
              (await findObjects('PublicClass', {
                'X-Parse-Session-Token': user1.getSessionToken(),
              })).data.find.results.map(object => object.someField)
            ).toEqual(['someValue4']);
            expect(
              (await findObjects('GraphQLClass', {
                'X-Parse-Session-Token': user2.getSessionToken(),
              })).data.find.results
                .map(object => object.someField)
                .sort()
            ).toEqual(['someValue1', 'someValue2', 'someValue3']);
            expect(
              (await findObjects('GraphQLClass', {
                'X-Parse-Session-Token': user3.getSessionToken(),
              })).data.find.results
                .map(object => object.someField)
                .sort()
            ).toEqual(['someValue1', 'someValue3']);
            expect(
              (await findObjects('GraphQLClass', {
                'X-Parse-Session-Token': user4.getSessionToken(),
              })).data.find.results.map(object => object.someField)
            ).toEqual([]);
            expect(
              (await findObjects('GraphQLClass', {
                'X-Parse-Session-Token': user5.getSessionToken(),
              })).data.find.results.map(object => object.someField)
            ).toEqual(['someValue3']);
          });

          it('should support where argument', async () => {
            await prepareData();

            const result = await apolloClient.query({
              query: gql`
                query FindSomeObjects($where: Object) {
                  find(className: "GraphQLClass", where: $where) {
                    results
                  }
                }
              `,
              variables: {
                where: {
                  someField: {
                    $in: ['someValue1', 'someValue2', 'someValue3'],
                  },
                  $or: [
                    {
                      pointerToUser: {
                        __type: 'Pointer',
                        className: '_User',
                        objectId: user5.id,
                      },
                    },
                    {
                      objectId: object1.id,
                    },
                  ],
                },
              },
              context: {
                headers: {
                  'X-Parse-Master-Key': 'test',
                },
              },
            });

            expect(
              result.data.find.results.map(object => object.someField).sort()
            ).toEqual(['someValue1', 'someValue3']);
          });

          it('should support order, skip and limit arguments', async () => {
            const promises = [];
            for (let i = 0; i < 100; i++) {
              const obj = new Parse.Object('SomeClass');
              obj.set('someField', `someValue${i < 10 ? '0' : ''}${i}`);
              obj.set('numberField', i % 3);
              promises.push(obj.save());
            }
            await Promise.all(promises);

            const result = await apolloClient.query({
              query: gql`
                query FindSomeObjects(
                  $className: String!
                  $where: Object
                  $order: String
                  $skip: Int
                  $limit: Int
                ) {
                  find(
                    className: $className
                    where: $where
                    order: $order
                    skip: $skip
                    limit: $limit
                  ) {
                    results
                  }
                }
              `,
              variables: {
                className: 'SomeClass',
                where: {
                  someField: {
                    $regex: '^someValue',
                  },
                },
                order: '-numberField,someField',
                skip: 4,
                limit: 2,
              },
            });

            expect(result.data.find.results.map(obj => obj.someField)).toEqual([
              'someValue14',
              'someValue17',
            ]);
          });

          it('should support count', async () => {
            await prepareData();
            const result = await apolloClient.query({
              query: gql`
                query FindSomeObjects($where: Object, $limit: Int) {
                  find(
                    className: "GraphQLClass"
                    where: $where
                    limit: $limit
                  ) {
                    results
                    count
                  }
                }
              `,
              variables: {
                where: {
                  someField: {
                    $in: ['someValue1', 'someValue2', 'someValue3'],
                  },
                  $or: [
                    {
                      pointerToUser: {
                        __type: 'Pointer',
                        className: '_User',
                        objectId: user5.id,
                      },
                    },
                    {
                      objectId: object1.id,
                    },
                  ],
                },
                limit: 0,
              },
              context: {
                headers: {
                  'X-Parse-Master-Key': 'test',
                },
              },
            });

            expect(result.data.find.results).toEqual([]);
            expect(result.data.find.count).toEqual(2);
          });

          it('should only count', async () => {
            await prepareData();
            const result = await apolloClient.query({
              query: gql`
                query FindSomeObjects($where: Object) {
                  find(className: "GraphQLClass", where: $where) {
                    count
                  }
                }
              `,
              variables: {
                where: {
                  someField: {
                    $in: ['someValue1', 'someValue2', 'someValue3'],
                  },
                  $or: [
                    {
                      pointerToUser: {
                        __type: 'Pointer',
                        className: '_User',
                        objectId: user5.id,
                      },
                    },
                    {
                      objectId: object1.id,
                    },
                  ],
                },
              },
              context: {
                headers: {
                  'X-Parse-Master-Key': 'test',
                },
              },
            });

            expect(result.data.find.results).toBeUndefined();
            expect(result.data.find.count).toEqual(2);
          });
        });
      });
    });
  });
});