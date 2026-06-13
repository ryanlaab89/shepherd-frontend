import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client'
import { setContext } from '@apollo/client/link/context'
import { API_BASE } from '@/lib/apiUrl'

const httpLink = createHttpLink({
  uri: `${API_BASE}/graphql`,
})

const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('token')
  return {
    headers: {
      ...headers,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  }
})

const cache = new InMemoryCache({
  typePolicies: {
    // Normalize these by id so overlapping queries share cache entries
    CheckIn:    { keyFields: ['id'] },
    Person:     { keyFields: ['id'] },
    Household:  { keyFields: ['id'] },
    Service:    { keyFields: ['id'] },
    User:       { keyFields: ['id'] },
    ClassGroup: { keyFields: ['id'] },
  },
})

export default new ApolloClient({
  link: authLink.concat(httpLink),
  cache,
  // Static data (services, users, classes, settings) use cache-first.
  // Queries that need live data override with cache-and-network + pollInterval.
  defaultOptions: {
    watchQuery: { fetchPolicy: 'cache-first' },
  },
})
