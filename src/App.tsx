import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import './App.css'
import type { Reminder, Subscription, ThemeMode, View } from './types'
import { storageKeys } from './constants'
import { House, List, CalendarDays, Settings, Plus, Bell, WifiOff, RefreshCw } from 'lucide-react'
import { usePersistedState } from './hooks/usePersistedState'
import { useGroups } from './hooks/useGroups'
import { useSubscriptions } from './hooks/useSubscriptions'
import { useCalendar } from './hooks/useCalendar'
import { useAuth } from './hooks/useAuth'
import { normalizeReminder, fetchAppStoreResults, normalizeAppKey, pickBestAppMatch } from './utils/subscription'
import { clearLocalAppData, readStorage } from './utils/storage'
import { toIsoDate } from './utils/date'
import { formatCurrency } from './utils/format'
import { getBudgetStatus, normalizeBudgetLimit } from './utils/budget'
import { getSubscriptionVisual } from './constants/subscriptionVisuals'
import { isNativePlatform, requestNotificationPermission } from './utils/notifications'
import { DashboardView } from './views/DashboardView'
import { SubscriptionsView } from './views/SubscriptionsView'
import { FormView } from './views/FormView'
import { TimelineView } from './views/TimelineView'
import { SettingsView } from './views/SettingsView'
import { SettlementView } from './views/SettlementView'
import { AuthScreen } from './components/AuthScreen'
import { InviteModal } from './components/InviteModal'

function App() {
  // Splash screen
  const [showSplash, setShowSplash] = useState(true)
  const [splashFading, setSplashFading] = useState(false)

  useEffect(() => {
    const fadeTimer = setTimeout(() => setSplashFading(true), 1200)
    const hideTimer = setTimeout(() => setShowSplash(false), 1700)
    return () => { clearTimeout(fadeTimer); clearTimeout(hideTimer) }
  }, [])

  // Settings
  const [activeView, setActiveView] = useState<View>('dashboard')
  const [currency, setCurrency] = usePersistedState(storageKeys.currency, 'EUR')
  const [theme, setTheme] = usePersistedState<ThemeMode>(storageKeys.theme, 'light')
  const [notificationsEnabled, setNotificationsEnabled] = usePersistedState(storageKeys.notifications, true)
  const [monthlyBudget, setMonthlyBudget] = usePersistedState(
    storageKeys.monthlyBudget,
    normalizeBudgetLimit(readStorage<number>(storageKeys.monthlyBudget, 0)),
    normalizeBudgetLimit,
  )
  const [defaultReminder] = usePersistedState<Reminder>(
    storageKeys.reminder,
    normalizeReminder(readStorage<number>(storageKeys.reminder, 3)),
  )
  const [appLogoCache, setAppLogoCache] = usePersistedState<Record<string, string>>(storageKeys.appLogoCache, {})

  // Callback refs (break auth -> subs circular dep)
  const loadSubsRef = useRef<(uid: string) => Promise<void>>(async () => {})
  const setSubsRef = useRef<React.Dispatch<React.SetStateAction<Subscription[]>>>(() => {})

  // Groups
  const groups = useGroups(defaultReminder)

  // Auth
  const auth = useAuth({
    loadSubscriptions: (uid) => loadSubsRef.current(uid),
    loadGroupsContext: groups.loadGroupsContext,
    handleAcceptInviteByToken: groups.handleAcceptInviteByToken,
    setSubscriptions: (v) => setSubsRef.current(v),
    resetGroups: groups.resetGroups,
    setActiveView,
    pendingInviteToken: groups.pendingInviteToken,
  })

  // Subscriptions
  const subs = useSubscriptions({
    userId: auth.userId,
    isGroupProfileActive: groups.isGroupProfileActive,
    effectiveSelectedGroupId: groups.effectiveSelectedGroupId,
    groupScopedSubscriptions: groups.groupScopedSubscriptions,
    selectedGroupMembers: groups.selectedGroupMembers,
    groupExpensePayerMemberId: groups.groupExpensePayerMemberId,
    groupExpenseParticipantIds: groups.groupExpenseParticipantIds,
    setGroupExpensePayerMemberId: groups.setGroupExpensePayerMemberId,
    setGroupExpenseParticipantIds: groups.setGroupExpenseParticipantIds,
    appLogoCache,
    setAppLogoCache,
    currency,
    notificationsEnabled,
    defaultReminder,
    isAuthenticated: auth.isAuthenticated,
    setIsSyncing: auth.setIsSyncing,
    activeView,
    setActiveView,
    loadGroupScopedSubscriptions: groups.loadGroupScopedSubscriptions,
    loadGroupMonthBalances: groups.loadGroupMonthBalances,
    setGroupsError: groups.setGroupsError,
  })

  // Calendar
  const calendar = useCalendar(subs.scopedSubscriptions, auth.userId)
  const subscriptionCount = subs.subscriptions.length
  const openSubscriptionForm = subs.openSubscriptionForm
  const personalBudgetStatus = getBudgetStatus(subs.personalMonthTotal, monthlyBudget)

  // Auto-open form for first-time users (0 subscriptions after initial load)
  const firstLoadCheckedRef = useRef(false)
  useEffect(() => {
    if (!auth.isAuthenticated) { firstLoadCheckedRef.current = false; return }
    if (auth.isSyncing || firstLoadCheckedRef.current) return
    firstLoadCheckedRef.current = true
    if (subscriptionCount === 0) {
      openSubscriptionForm(null)
    }
  }, [auth.isAuthenticated, auth.isSyncing, openSubscriptionForm, subscriptionCount])

  // Daily payment alert
  const [dailyAlertDismissed, setDailyAlertDismissed] = usePersistedState(storageKeys.dailyAlertDismissed, '')
  const [showBellPanel, setShowBellPanel] = useState(false)
  const [showAnalysis, setShowAnalysis] = usePersistedState(storageKeys.dashAnalysis, false)
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const todayIso = toIsoDate(new Date())
  const bellCount = calendar.todayPendingCharges.length
  const checkPendingInviteModal = groups.checkPendingInviteModal
  const pendingInviteToken = groups.pendingInviteToken
  const shouldShowDailyAlert = calendar.todayPendingCharges.length > 0 && dailyAlertDismissed !== todayIso

  // Offline detection
  useEffect(() => {
    const goOffline = () => setIsOffline(true)
    const goOnline = () => setIsOffline(false)
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])

  useEffect(() => {
    const onUpdateAvailable = () => setUpdateAvailable(true)
    window.addEventListener('notifyra:update-available', onUpdateAvailable)
    return () => window.removeEventListener('notifyra:update-available', onUpdateAvailable)
  }, [])

  const handleApplyUpdate = () => {
    window.notifyraApplyUpdate?.()
  }

  const handleClearDeviceData = async () => {
    await auth.handleLogout()
    await clearLocalAppData()
    window.location.replace(window.location.origin + window.location.pathname)
  }

  const handleDailyAlertPayAll = () => {
    calendar.handleMarkAllTodayPaid()
    setDailyAlertDismissed(todayIso)
  }

  const handleDailyAlertDismiss = () => {
    setDailyAlertDismissed(todayIso)
  }

  // Wire callback refs before auth's passive bootstrap effect runs.
  useLayoutEffect(() => {
    loadSubsRef.current = subs.loadSubscriptions
    setSubsRef.current = subs.setSubscriptions
  }, [subs.loadSubscriptions, subs.setSubscriptions])

  // Request notification permissions at startup (native)
  useEffect(() => {
    if (notificationsEnabled && isNativePlatform()) {
      void requestNotificationPermission()
    }
  }, [notificationsEnabled])

  // App logo hydration
  useEffect(() => {
    const candidates = subs.subscriptions
      .filter((item) => !item.customLogoUrl)
      .map((item) => item.name.trim())
      .filter((name) => name.length >= 2)
      .filter((name, i, all) => all.indexOf(name) === i)

    if (candidates.length === 0) return
    const missing = candidates.filter((name) => !appLogoCache[normalizeAppKey(name)])
    if (missing.length === 0) return

    let cancelled = false
    const hydrate = async () => {
      for (const name of missing.slice(0, 8)) {
        if (cancelled) break
        try {
          const results = await fetchAppStoreResults(name, 5)
          const bestMatch = pickBestAppMatch(name, results)
          if (bestMatch?.iconUrl) {
            const key = normalizeAppKey(name)
            setAppLogoCache((cur) => (cur[key] === bestMatch.iconUrl ? cur : { ...cur, [key]: bestMatch.iconUrl }))
          }
        } catch { /* fallback */ }
      }
    }
    void hydrate()
    return () => { cancelled = true }
  }, [appLogoCache, setAppLogoCache, subs.subscriptions])

  // Invite modal
  useEffect(() => {
    if (!auth.isAuthenticated || !pendingInviteToken || !auth.userId) return
    void checkPendingInviteModal()
  }, [auth.isAuthenticated, pendingInviteToken, auth.userId, checkPendingInviteModal])

  // Render
  if (showSplash) {
    return (
      <div className={`app-splash ${splashFading ? 'fade-out' : ''}`}>
        <div className="app-splash-logo">N</div>
        <span className="app-splash-name">Notifyra</span>
      </div>
    )
  }

  if (!auth.isAuthenticated) {
    return (
      <AuthScreen
        theme={theme}
        authMode={auth.authMode}
        setAuthMode={auth.setAuthMode}
        email={auth.email}
        setEmail={auth.setEmail}
        password={auth.password}
        setPassword={auth.setPassword}
        confirmPassword={auth.confirmPassword}
        setConfirmPassword={auth.setConfirmPassword}
        formDisplayName={auth.formDisplayName}
        setFormDisplayName={auth.setFormDisplayName}
        authError={auth.authError}
        authSuccess={auth.authSuccess}
        isSyncing={auth.isSyncing}
        pendingInviteToken={groups.pendingInviteToken}
        handleAuthSubmit={auth.handleAuthSubmit}
        handleOAuthLogin={auth.handleOAuthLogin}
        handleDevLogin={auth.handleDevLogin}
      />
    )
  }

  return (
    <main className={`app-shell ${theme}`}>
      <div className="status-bar-bg" />
      {isOffline && (
        <div className="offline-banner" role="alert">
          <WifiOff size={14} strokeWidth={2.2} />
          <span>Sin conexión a internet</span>
        </div>
      )}
      {updateAvailable && (
        <div className="update-banner" role="status">
          <span>Nueva versión disponible</span>
          <button type="button" onClick={handleApplyUpdate}>
            <RefreshCw size={13} strokeWidth={2.3} />
            Actualizar
          </button>
        </div>
      )}
      <section className="screen" key={activeView}>
        {activeView === 'dashboard' && (
          <DashboardView
            isGroupProfileActive={groups.isGroupProfileActive}
            activeProfileContext={groups.activeProfileContext}
            activeProfileLabel={groups.activeProfileLabel}
            showProfileMenu={groups.showProfileMenu}
            setShowProfileMenu={groups.setShowProfileMenu}
            groups={groups.groups}
            selectedGroupMembers={groups.selectedGroupMembers}
            incomingInvites={groups.incomingInvites}
            inviteGroups={groups.inviteGroups}
            groupsError={groups.groupsError}
            groupsSuccess={groups.groupsSuccess}
            newGroupName={groups.newGroupName}
            setNewGroupName={groups.setNewGroupName}
            inviteEmailInput={groups.inviteEmailInput}
            setInviteEmailInput={groups.setInviteEmailInput}
            lastInviteLink={groups.lastInviteLink}
            setLastInviteLink={groups.setLastInviteLink}
            personalMonthTotal={subs.personalMonthTotal}
            combinedMonthTotal={subs.combinedMonthTotal}
            groupOnlyMonthTotal={subs.groupOnlyMonthTotal}
            groupOnlyYearTotal={subs.groupOnlyYearTotal}
            todayCharges={subs.todayCharges}
            upcoming30={subs.upcoming30}
            topExpensive={subs.topExpensive}
            categoryBreakdown={subs.categoryBreakdown}
            groupReceivables={groups.groupReceivables}
            groupDebts={groups.groupDebts}
            monthlyProjection={subs.monthlyProjection}
            monthlyPaymentSummary={calendar.monthlyPaymentSummary}
            personalBudgetStatus={personalBudgetStatus}
            currency={currency}
            appLogoCache={appLogoCache}
            handleChangeProfileContext={groups.handleChangeProfileContext}
            setActiveView={setActiveView}
            handleCreateGroup={() => groups.handleCreateGroup(auth.userId, auth.email)}
            handleInviteMember={() => groups.handleInviteMember(auth.userId, auth.email)}
            handleAcceptInvite={(id) => groups.handleAcceptInvite(id, auth.userId, auth.email)}
            handleDeclineInvite={(id) => groups.handleDeclineInvite(id, auth.userId, auth.email)}
            setGroupsSuccess={groups.setGroupsSuccess}
            bellCount={bellCount}
            showBellPanel={showBellPanel}
            setShowBellPanel={setShowBellPanel}
            todayPendingCharges={calendar.todayPendingCharges}
            handleMarkAllTodayPaid={handleDailyAlertPayAll}
            showAnalysis={showAnalysis}
            setShowAnalysis={setShowAnalysis}
          />
        )}
        {activeView === 'subscriptions' && (
          <SubscriptionsView
            visibleSubscriptions={subs.visibleSubscriptions}
            searchTerm={subs.searchTerm}
            setSearchTerm={subs.setSearchTerm}
            subscriptionFilter={subs.subscriptionFilter}
            setSubscriptionFilter={subs.setSubscriptionFilter}
            chargeOrder={subs.chargeOrder}
            setChargeOrder={subs.setChargeOrder}
            frequencyFilter={subs.frequencyFilter}
            setFrequencyFilter={subs.setFrequencyFilter}
            excludedCategories={subs.excludedCategories}
            setExcludedCategories={subs.setExcludedCategories}
            categorySearchTerm={subs.categorySearchTerm}
            setCategorySearchTerm={subs.setCategorySearchTerm}
            showAdvancedFilters={subs.showAdvancedFilters}
            setShowAdvancedFilters={subs.setShowAdvancedFilters}
            availableCategories={subs.availableCategories}
            visibleCategoryOptions={subs.visibleCategoryOptions}
            activeFilterCount={subs.activeFilterCount}
            currency={currency}
            appLogoCache={appLogoCache}
            isSyncing={auth.isSyncing}
            subscriptionsNotice={subs.subscriptionsNotice}
            openSubscriptionForm={subs.openSubscriptionForm}
            handleToggleSubscriptionStatus={subs.handleToggleSubscriptionStatus}
            handleSoftDeleteSubscription={subs.handleSoftDeleteSubscription}
          />
        )}
        {activeView === 'form' && (
          <FormView
            editingSubscription={subs.editingSubscription}
            isGroupProfileActive={groups.isGroupProfileActive}
            activeProfileLabel={groups.activeProfileLabel}
            selectedGroupMembers={groups.selectedGroupMembers}
            groupExpensePayerMemberId={groups.groupExpensePayerMemberId}
            setGroupExpensePayerMemberId={groups.setGroupExpensePayerMemberId}
            groupExpenseParticipantIds={groups.groupExpenseParticipantIds}
            setGroupExpenseParticipantIds={groups.setGroupExpenseParticipantIds}
            formName={subs.formName}
            setFormName={subs.setFormName}
            formCategory={subs.formCategory}
            setFormCategory={subs.setFormCategory}
            formCustomLogoUrl={subs.formCustomLogoUrl}
            setFormCustomLogoUrl={subs.setFormCustomLogoUrl}
            formAmount={subs.formAmount}
            setFormAmount={subs.setFormAmount}
            formIconKey={subs.formIconKey}
            setFormIconKey={subs.setFormIconKey}
            formIsFinanced={subs.formIsFinanced}
            setFormIsFinanced={subs.setFormIsFinanced}
            formFinancingProviderName={subs.formFinancingProviderName}
            setFormFinancingProviderName={subs.setFormFinancingProviderName}
            formFinancingProviderLogoUrl={subs.formFinancingProviderLogoUrl}
            setFormFinancingProviderLogoUrl={subs.setFormFinancingProviderLogoUrl}
            financingProviderSearchTerm={subs.financingProviderSearchTerm}
            setFinancingProviderSearchTerm={subs.setFinancingProviderSearchTerm}
            financingProviderResults={subs.financingProviderResults}
            financingProviderSearchLoading={subs.financingProviderSearchLoading}
            financingProviderSearchError={subs.financingProviderSearchError}
            formSaveError={subs.formSaveError}
            showIconPicker={subs.showIconPicker}
            formEntryStep={subs.formEntryStep}
            setFormEntryStep={subs.setFormEntryStep}
            isManualEntry={subs.isManualEntry}
            setIsManualEntry={subs.setIsManualEntry}
            appSearchTerm={subs.appSearchTerm}
            setAppSearchTerm={subs.setAppSearchTerm}
            appStoreResults={subs.appStoreResults}
            appSearchLoading={subs.appSearchLoading}
            appSearchError={subs.appSearchError}
            currency={currency}
            isSyncing={auth.isSyncing}
            isOffline={isOffline}
            defaultReminder={defaultReminder}
            handleNameBlur={subs.handleNameBlur}
            handleSelectAppResult={subs.handleSelectAppResult}
            handleSelectFinancingProvider={subs.handleSelectFinancingProvider}
            handleSaveSubscription={subs.handleSaveSubscription}
            setActiveView={setActiveView}
            appLogoCache={appLogoCache}
            setAppLogoCache={setAppLogoCache}
          />
        )}
        {activeView === 'timeline' && (
          <TimelineView
            calendarMonth={calendar.calendarMonth}
            setCalendarMonth={calendar.setCalendarMonth}
            calendarMonthLabel={calendar.calendarMonthLabel}
            selectedCalendarDate={calendar.selectedCalendarDate}
            setSelectedCalendarDate={calendar.setSelectedCalendarDate}
            calendarCells={calendar.calendarCells}
            calendarChargesByDate={calendar.calendarChargesByDate}
            selectedDayCharges={calendar.selectedDayCharges}
            selectedDayPendingCount={calendar.selectedDayPendingCount}
            chargePayments={calendar.chargePayments}
            currency={currency}
            appLogoCache={appLogoCache}
            handleToggleChargePaid={calendar.handleToggleChargePaid}
          />
        )}
        {activeView === 'settings' && (
          <SettingsView
            currency={currency}
            setCurrency={setCurrency}
            theme={theme}
            setTheme={setTheme}
            notificationsEnabled={notificationsEnabled}
            setNotificationsEnabled={setNotificationsEnabled}
            monthlyBudget={monthlyBudget}
            setMonthlyBudget={setMonthlyBudget}
            isOffline={isOffline}
            handleLogout={auth.handleLogout}
            handleClearDeviceData={handleClearDeviceData}
            handleDeleteAccount={auth.handleDeleteAccount}
            email={auth.email ?? ''}
            subscriptionCount={subs.subscriptions.length}
            activeCount={subs.activeSubscriptions.length}
            monthlyTotal={subs.personalMonthTotal}
            formatCurrency={formatCurrency}
            priceHistory={subs.priceHistory}
            handleImportFile={subs.handleImportFile}
            importStatus={subs.importStatus}
            importError={subs.importError}
          />
        )}
        {activeView === 'settlements' && groups.isGroupProfileActive && (
          <SettlementView
            groupId={groups.effectiveSelectedGroupId}
            groupName={groups.activeProfileLabel}
            currency={currency}
            formatCurrency={formatCurrency}
          />
        )}
      </section>

      <nav className="bottom-nav" aria-label="Navegación principal">
        <button type="button" onClick={() => setActiveView('dashboard')} className={activeView === 'dashboard' ? 'active' : ''} aria-current={activeView === 'dashboard' ? 'page' : undefined}>
          <House size={20} strokeWidth={activeView === 'dashboard' ? 2.2 : 1.6} />
          <span>Inicio</span>
        </button>
        <button type="button" onClick={() => setActiveView('subscriptions')} className={activeView === 'subscriptions' ? 'active' : ''} aria-current={activeView === 'subscriptions' ? 'page' : undefined}>
          <List size={20} strokeWidth={activeView === 'subscriptions' ? 2.2 : 1.6} />
          <span>Lista</span>
        </button>
        <button type="button" onClick={() => subs.openSubscriptionForm(null)} className={activeView === 'form' ? 'active add' : 'add'}>
          <Plus size={26} strokeWidth={1.8} />
        </button>
        <button type="button" onClick={() => setActiveView('timeline')} className={activeView === 'timeline' ? 'active' : ''} aria-current={activeView === 'timeline' ? 'page' : undefined}>
          <CalendarDays size={20} strokeWidth={activeView === 'timeline' ? 2.2 : 1.6} />
          <span>Calendario</span>
        </button>
        <button type="button" onClick={() => setActiveView('settings')} className={activeView === 'settings' ? 'active' : ''} aria-current={activeView === 'settings' ? 'page' : undefined}>
          <Settings size={20} strokeWidth={activeView === 'settings' ? 2.2 : 1.6} />
          <span>Ajustes</span>
        </button>
      </nav>

      {groups.showInviteModal && (
        <InviteModal
          groupsError={groups.groupsError}
          inviteModalGroupName={groups.inviteModalGroupName}
          inviteModalLoading={groups.inviteModalLoading}
          pendingInviteToken={groups.pendingInviteToken}
          userId={auth.userId}
          email={auth.email}
          setPendingInviteToken={groups.setPendingInviteToken}
          setShowInviteModal={groups.setShowInviteModal}
          setGroupsError={groups.setGroupsError}
          setInviteModalLoading={groups.setInviteModalLoading}
          handleAcceptInviteByToken={groups.handleAcceptInviteByToken}
        />
      )}

      {/* ── Daily payment alert modal ─────────── */}
      {shouldShowDailyAlert && (
        <div className="daily-alert-overlay" onClick={handleDailyAlertDismiss}>
          <div className="daily-alert" onClick={(e) => e.stopPropagation()}>
            <div className="daily-alert-header">
              <Bell size={22} />
              <h2>Cobros de hoy</h2>
            </div>
            <p className="daily-alert-sub">Tienes {calendar.todayPendingCharges.length} {calendar.todayPendingCharges.length === 1 ? 'pago pendiente' : 'pagos pendientes'} hoy</p>
            <ul className="daily-alert-list">
              {calendar.todayPendingCharges.map((sub) => {
                const visual = getSubscriptionVisual(sub.name, sub.category, sub.status)
                const logoSrc = sub.customLogoUrl || appLogoCache[normalizeAppKey(sub.name)] || visual.logoSrc
                return (
                  <li key={sub.id}>
                    <div className={`dash-icon ${logoSrc ? 'has-logo' : ''}`} style={{ '--tone': visual.tone } as React.CSSProperties}>
                      {logoSrc ? <img src={logoSrc} alt="" /> : <span>{sub.name.charAt(0)}</span>}
                    </div>
                    <strong>{sub.name}</strong>
                    <span>{formatCurrency(sub.amount, currency)}</span>
                  </li>
                )
              })}
            </ul>
            <div className="daily-alert-total">
              <span>Total</span>
              <strong>{formatCurrency(calendar.todayPendingCharges.reduce((s, c) => s + c.amount, 0), currency)}</strong>
            </div>
            <div className="daily-alert-actions">
              <button type="button" className="daily-alert-pay" onClick={handleDailyAlertPayAll}>
                Marcar todo como pagado
              </button>
              <button type="button" className="daily-alert-later" onClick={handleDailyAlertDismiss}>
                Más tarde
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default App
