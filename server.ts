import * as http from 'node:http'
import * as https from 'node:https'
import { createRequestListener } from 'remix/node-fetch-server'

import { router } from './app/router.ts'
import {
  isNotebookProxyPath,
  resolveNotebookTarget,
  upstreamWsPath,
} from './app/data/sprites/notebook-proxy.ts'

function formatHeaderLines(rawHeaders: string[]): string {
  let lines = ''
  for (let i = 0; i < rawHeaders.length; i += 2) {
    lines += `${rawHeaders[i]}: ${rawHeaders[i + 1]}\r\n`
  }
  return lines
}

const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 44100

const server = http.createServer(
  createRequestListener(async (request) => {
    try {
      return await router.fetch(request)
    } catch (error) {
      if (!(request.signal.aborted && error === request.signal.reason)) {
        console.error(error)
      }
      return new Response('Internal Server Error', { status: 500 })
    }
  }),
)

// WebSocket upgrades (marimo's kernel connection, LSP, terminal) bypass the
// fetch-based router entirely -- Node only exposes them as a raw socket
// event -- so `/notebook/app/*` is proxied here at the TCP level instead of
// through `notebookProxy()` middleware.
server.on('upgrade', (req, clientSocket, head) => {
  clientSocket.on('error', () => clientSocket.destroy())

  let url = new URL(req.url ?? '/', 'http://notebook-proxy.internal')
  if (!isNotebookProxyPath(url.pathname)) {
    clientSocket.destroy()
    return
  }

  resolveNotebookTarget(req.headers.cookie).then((target) => {
    if (!target) {
      clientSocket.end('HTTP/1.1 404 Not Found\r\n\r\n')
      return
    }

    let targetUrl = new URL(target.url)
    let isTls = targetUrl.protocol === 'https:'
    let requestModule = isTls ? https : http

    let headers: http.OutgoingHttpHeaders = { ...req.headers }
    delete headers.host
    delete headers.cookie
    headers.authorization = `Bearer ${target.token}`

    let proxyReq = requestModule.request({
      host: targetUrl.hostname,
      port: targetUrl.port || (isTls ? 443 : 80),
      method: req.method,
      path: upstreamWsPath(req.url ?? '/'),
      headers,
    })

    proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
      clientSocket.write(`HTTP/1.1 ${proxyRes.statusCode} ${proxyRes.statusMessage}\r\n`)
      clientSocket.write(formatHeaderLines(proxyRes.rawHeaders))
      clientSocket.write('\r\n')

      if (head.length > 0) proxySocket.write(head)
      if (proxyHead.length > 0) clientSocket.write(proxyHead)

      proxySocket.on('error', () => clientSocket.destroy())
      proxySocket.pipe(clientSocket)
      clientSocket.pipe(proxySocket)
    })

    // marimo rejected the handshake outright (e.g. a 4xx) instead of
    // upgrading -- relay its response instead of leaving the client hanging.
    proxyReq.on('response', (proxyRes) => {
      clientSocket.write(`HTTP/1.1 ${proxyRes.statusCode} ${proxyRes.statusMessage}\r\n`)
      clientSocket.write(formatHeaderLines(proxyRes.rawHeaders))
      clientSocket.write('\r\n')
      proxyRes.pipe(clientSocket)
    })

    proxyReq.on('error', () => clientSocket.destroy())
    proxyReq.end()
  })
})

server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`)
})

let shuttingDown = false

function shutdown() {
  if (shuttingDown) {
    return
  }

  shuttingDown = true
  server.close(() => process.exit(0))
  server.closeAllConnections()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
