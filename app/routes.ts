import { get, post, route } from 'remix/routes'

export const routes = route({
  assets: get('/assets/*path'),
  home: '/',

  auth: route('auth', {
    google: route('google', {
      index: get('/'),
      callback: get('/callback'),
    }),
    logout: post('logout'),
  }),

  notebook: route('notebook', {
    provision: post('provision'),
    reset: post('reset'),
    destroy: post('destroy'),
  }),

  settings: route('settings', {
    index: get('/'),
  }),

  admin: route('admin', {
    addUser: post('users'),
    setRole: post('users/:email/role'),
    removeUser: post('users/:email/remove'),
  }),
})
