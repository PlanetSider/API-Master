import { serve } from "@hono/node-server"

import { AccountRefreshScheduler } from "./accountRefreshScheduler"
import { AccountRefreshService } from "./accountRefreshService"
import { AccountsRepository } from "./accountsRepository"
import { ApiCredentialProfileRepository } from "./apiCredentialProfileRepository"
import { createWebApp } from "./app"
import { AutomationSettingsRepository } from "./automationSettingsRepository"
import { BackupService } from "./backupService"
import { BalanceHistoryRepository } from "./balanceHistoryRepository"
import { ChannelConfigRepository } from "./channelConfigRepository"
import { CheckInScheduler } from "./checkInScheduler"
import { CheckInService } from "./checkInService"
import { loadWebServerConfig } from "./config"
import { EncryptedDocumentStore } from "./encryptedDocumentStore"
import { ExternalNotificationRepository } from "./externalNotificationRepository"
import { ExternalNotificationService } from "./externalNotificationService"
import { KeyManagementService } from "./keyManagementService"
import { ManagedSiteRepository } from "./managedSiteRepository"
import { ManagedSiteService } from "./managedSiteService"
import { ModelCatalogService } from "./modelCatalogService"
import { NotificationRepository } from "./notificationRepository"
import { NotificationService } from "./notificationService"
import { SiteAnnouncementRepository } from "./siteAnnouncementRepository"
import { SiteAnnouncementScheduler } from "./siteAnnouncementScheduler"
import { SiteAnnouncementService } from "./siteAnnouncementService"
import { installServerFetchGuard } from "./ssrfGuard"
import { TagRepository } from "./tagRepository"
import { UsageHistoryRepository } from "./usageHistoryRepository"
import { UsageHistoryService } from "./usageHistoryService"
import { webDavClient } from "./webDavClient"
import { WebDavRepository } from "./webDavRepository"
import { WebDavService } from "./webDavService"

installServerFetchGuard()

const config = loadWebServerConfig()
const documentStore = new EncryptedDocumentStore(
  config.databasePath,
  config.encryptionSecret,
)
const accountsRepository = new AccountsRepository(documentStore)
const tagRepository = new TagRepository(documentStore)
const apiCredentialProfileRepository = new ApiCredentialProfileRepository(
  documentStore,
)
const automationSettingsRepository = new AutomationSettingsRepository(
  documentStore,
)
const balanceHistoryRepository = new BalanceHistoryRepository(documentStore)
const usageHistoryRepository = new UsageHistoryRepository(documentStore)
const usageHistoryService = new UsageHistoryService(usageHistoryRepository)
const notificationRepository = new NotificationRepository(documentStore)
const externalNotificationRepository = new ExternalNotificationRepository(
  documentStore,
)
const externalNotificationService = new ExternalNotificationService(
  externalNotificationRepository,
)
const notificationService = new NotificationService(
  notificationRepository,
  externalNotificationService,
)
const modelCatalogService = new ModelCatalogService()
const keyManagementService = new KeyManagementService()
const managedSiteRepository = new ManagedSiteRepository(documentStore)
const channelConfigRepository = new ChannelConfigRepository(documentStore)
const managedSiteService = new ManagedSiteService(channelConfigRepository)
const backupService = new BackupService(documentStore)
const webDavRepository = new WebDavRepository(documentStore)
const webDavService = new WebDavService(
  webDavRepository,
  backupService,
  webDavClient,
  notificationService,
)
const siteAnnouncementRepository = new SiteAnnouncementRepository(documentStore)
const siteAnnouncementService = new SiteAnnouncementService(
  accountsRepository,
  siteAnnouncementRepository,
  automationSettingsRepository,
  notificationService,
)
const siteAnnouncementScheduler = new SiteAnnouncementScheduler(
  siteAnnouncementService,
  automationSettingsRepository,
)
const accountRefreshScheduler = new AccountRefreshScheduler(
  accountsRepository,
  automationSettingsRepository,
  new AccountRefreshService(),
  balanceHistoryRepository,
  usageHistoryService,
  notificationService,
)
const checkInScheduler = new CheckInScheduler(
  accountsRepository,
  automationSettingsRepository,
  new CheckInService(),
  notificationService,
)
const app = createWebApp({
  config,
  accountsRepository,
  automationSettingsRepository,
  accountRefreshScheduler,
  checkInScheduler,
  balanceHistoryRepository,
  usageHistoryRepository,
  usageHistoryService,
  notificationRepository,
  notificationService,
  modelCatalogService,
  keyManagementService,
  managedSiteRepository,
  managedSiteService,
  backupService,
  webDavService,
  externalNotificationService,
  apiCredentialProfileRepository,
  siteAnnouncementService,
  siteAnnouncementScheduler,
  tagRepository,
  channelConfigRepository,
})
accountRefreshScheduler.start()
checkInScheduler.start()
webDavService.start()
siteAnnouncementScheduler.start()

const server = serve(
  {
    fetch: app.fetch,
    hostname: config.host,
    port: config.port,
  },
  ({ address, port }) => {
    const visibleHost = address === "0.0.0.0" ? "localhost" : address
    console.log(`All API Hub Web is running at http://${visibleHost}:${port}`)
  },
)

const shutdown = () => {
  accountRefreshScheduler.stop()
  checkInScheduler.stop()
  webDavService.stop()
  siteAnnouncementScheduler.stop()
  server.close(() => {
    documentStore.close()
    process.exit(0)
  })
}

process.once("SIGINT", shutdown)
process.once("SIGTERM", shutdown)
