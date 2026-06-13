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

const client = new ApolloClient({
  link: authLink.concat(httpLink),
  cache,
  defaultOptions: {
    watchQuery: { fetchPolicy: 'cache-and-network' },
  },
})

// Refetch all active queries when the tab/app comes back into view.
// Fixes stale empty-cache reads on mobile where tabs stay alive in the background.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    client.refetchQueries({ include: 'active' })
  }
})

export default client
