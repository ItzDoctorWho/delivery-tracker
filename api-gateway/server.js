const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const app = require('./src/app');
const typeDefs = require('./src/graphql/typeDefs');
const resolvers = require('./src/graphql/resolvers');

async function startServer() {
  const apolloServer = new ApolloServer({
    typeDefs,
    resolvers
  });
  await apolloServer.start();

  app.use('/graphql', expressMiddleware(apolloServer));

  const port = process.env.PORT || '4000';
  app.listen(port, () => {
    console.log(`API Gateway REST running on http://localhost:${port}/api`);
    console.log(`API Gateway GraphQL running on http://localhost:${port}/graphql`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
