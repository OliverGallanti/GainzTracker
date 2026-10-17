import { buildApp } from './app.ts'
import { config } from './config.ts'

const app = buildApp()

app
  .listen({ port: config.PORT, host: '0.0.0.0' })
  .then((address) => {
    app.log.info(`GainzTracker BFF listening at ${address}`)
  })
  .catch((err) => {
    app.log.error(err)
    process.exit(1)
  })
