import { GraphQLNonNull, GraphQLBoolean, GraphQLObjectType } from 'graphql';
import { mutationWithClientMutationId } from 'graphql-relay';
import * as defaultGraphQLTypes from './defaultGraphQLTypes';
import rest from '../../rest';

const parseMap = {
  _op: '__op',
};

const transformToParse = fields => {
  if (!fields || typeof fields !== 'object') {
    return;
  }
  Object.keys(fields).forEach(fieldName => {
    const fieldValue = fields[fieldName];
    if (parseMap[fieldName]) {
      delete fields[fieldName];
      fields[parseMap[fieldName]] = fieldValue;
    }
    if (typeof fieldValue === 'object') {
      transformToParse(fieldValue);
    }
  });
};

const createObject = async (className, fields, config, auth, info) => {
  if (!fields) {
    fields = {};
  }

  transformToParse(fields);

  return (await rest.create(config, auth, className, fields, info.clientSDK))
    .response;
};

const updateObject = async (
  className,
  objectId,
  fields,
  config,
  auth,
  info
) => {
  if (!fields) {
    fields = {};
  }

  transformToParse(fields);

  return (await rest.update(
    config,
    auth,
    className,
    { objectId },
    fields,
    info.clientSDK
  )).response;
};

const deleteObject = async (className, objectId, config, auth, info) => {
  await rest.del(config, auth, className, objectId, info.clientSDK);
  return true;
};

const loadCreate = parseGraphQLSchema => {
  const description =
    'The create mutation can be used to create a new object of a certain class.';
  const args = {
    className: defaultGraphQLTypes.CLASS_NAME_ATT,
    fields: defaultGraphQLTypes.FIELDS_ATT,
  };
  const type = new GraphQLNonNull(defaultGraphQLTypes.CREATE_RESULT);
  const resolve = async (_source, args, context) => {
    try {
      const { className, fields } = args;
      const { config, auth, info } = context;

      return await createObject(className, fields, config, auth, info);
    } catch (e) {
      parseGraphQLSchema.handleError(e);
    }
  };

  let createField;
  if (parseGraphQLSchema.graphQLSchemaIsRelayStyle) {
    createField = mutationWithClientMutationId({
      name: 'CreateObject',
      inputFields: args,
      outputFields: {
        result: { type },
      },
      mutateAndGetPayload: async (args, context) => ({
        result: resolve(undefined, args, context),
      }),
    });
  } else {
    createField = {
      description,
      args,
      type,
      resolve,
    };
  }
  parseGraphQLSchema.graphQLObjectsMutations.create = createField;
};

const loadUpdate = parseGraphQLSchema => {
  const description =
    'The update mutation can be used to update an object of a certain class.';
  const args = {
    className: defaultGraphQLTypes.CLASS_NAME_ATT,
    objectId: defaultGraphQLTypes.OBJECT_ID_ATT,
    fields: defaultGraphQLTypes.FIELDS_ATT,
  };
  const type = new GraphQLNonNull(defaultGraphQLTypes.UPDATE_RESULT);
  const resolve = async (_source, args, context) => {
    try {
      const { className, objectId, fields } = args;
      const { config, auth, info } = context;

      return await updateObject(
        className,
        objectId,
        fields,
        config,
        auth,
        info
      );
    } catch (e) {
      parseGraphQLSchema.handleError(e);
    }
  };

  let updateField;
  if (parseGraphQLSchema.graphQLSchemaIsRelayStyle) {
    updateField = mutationWithClientMutationId({
      name: 'UpdateObject',
      inputFields: args,
      outputFields: {
        result: { type },
      },
      mutateAndGetPayload: async (args, context) => ({
        result: resolve(undefined, args, context),
      }),
    });
  } else {
    updateField = {
      description,
      args,
      type,
      resolve,
    };
  }
  parseGraphQLSchema.graphQLObjectsMutations.update = updateField;
};

const load = parseGraphQLSchema => {
  loadCreate(parseGraphQLSchema);
  loadUpdate(parseGraphQLSchema);

  parseGraphQLSchema.graphQLObjectsMutations.delete = {
    description:
      'The delete mutation can be used to delete an object of a certain class.',
    args: {
      className: defaultGraphQLTypes.CLASS_NAME_ATT,
      objectId: defaultGraphQLTypes.OBJECT_ID_ATT,
    },
    type: new GraphQLNonNull(GraphQLBoolean),
    async resolve(_source, args, context) {
      try {
        const { className, objectId } = args;
        const { config, auth, info } = context;

        return await deleteObject(className, objectId, config, auth, info);
      } catch (e) {
        parseGraphQLSchema.handleError(e);
      }
    },
  };

  const objectsMutation = new GraphQLObjectType({
    name: 'ObjectsMutation',
    description: 'ObjectsMutation is the top level type for objects mutations.',
    fields: parseGraphQLSchema.graphQLObjectsMutations,
  });
  parseGraphQLSchema.graphQLTypes.push(objectsMutation);

  parseGraphQLSchema.graphQLMutations.objects = {
    description: 'This is the top level for objects mutations.',
    type: objectsMutation,
    resolve: () => new Object(),
  };
};

export { createObject, updateObject, deleteObject, load };
