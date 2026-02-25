import { useEffect, useRef, useState } from 'react'
import './App.css'
import type { BeforeInstallPromptEvent, Reminder, Subscription, ThemeMode, View } from './types'
import { storageKeys } from './constants'
import { House, List, CalendarDays, Settings, Plus } from 'lucide-react'
import { usePersistedState } from './hooks/usePersistedState'
import { useGroups } from './hooks/useGroups'
import { useSubscriptions } from './hooks/useSubscriptions'
import { useCalendar } from './hooks/useCalendar'
import { useAuth } from './hooks/useAuth'
import { normalizeReminder, fetchAppStoreResults, normalizeAppKey, pickBestAppMatch } from './utils/subscription'
import { readStorage } from './utils/storage'
import { DashboardView } from './views/DashboardView'
import { SubscriptionsView } from './views/SubscriptionsView'
import { FormView } from './views/FormView'
import { TimelineView } from './views/TimelineView'
import { SettingsView } from './views/SettingsView'
import { AuthScreen } from './components/AuthScreen'
import { InviteModal } from './components/InviteModal'

function App() {
  // Settings
  const [activeView, setActiveView] = useState<View>('dashboard')
  const [currency, setCurrency] = usePersistedState(storageKeys.currency, 'EUR')
  const [theme, setTheme] = usePersistedState<ThemeMode>(storageKeys.theme, 'light')
  const [notificationsEnabled, setNotificationsEnabled] = usePersistedState(storageKeys.notifications, true)
  const [defaultReminder, setDefaultReminder] = usePersistedState<Reminder>(
    storageKeys.reminder,
    normalizeReminder(readStorage<number>(storageKeys.reminder, 3)),
  )
  const [pwaPrompt, setPwaPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showInstallHelp, setShowInstallHelp] = useState(false)
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
  const calendar = useCalendar(subs.scopedSubscriptions)

  // Wire callback refs
  loadSubsRef.current = subs.loadSubscriptions
  setSubsRef.current = subs.setSubscriptions

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

  // PWA prompt
  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setPwaPrompt(e as BeforeInstallPromptEvent) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // Invite modal
  useEffect(() => {
    if (!auth.isAuthenticated || !groups.pendingInviteToken || !auth.userId) return
    void groups.checkPendingInviteModal(auth.userId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.isAuthenticated, groups.pendingInviteToken, auth.userId])

  // Render
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
      />
    )
  }

  return (
    <main className={`app-shell ${theme}`}>
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
            currency={currency}
            appLogoCache={appLogoCache}
            handleChangeProfileContext={groups.handleChangeProfileContext}
            setActiveView={setActiveView}
            handleCreateGroup={() => groups.handleCreateGroup(auth.userId, auth.email)}
            handleInviteMember={() => groups.handleInviteMember(auth.userId, auth.email)}
            handleAcceptInvite={(id) => groups.handleAcceptInvite(id, auth.userId, auth.email)}
            handleDeclineInvite={(id) => groups.handleDeclineInvite(id, auth.userId, auth.email)}
            setGroupsSuccess={groups.setGroupsSuccess}
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
            defaultReminder={defaultReminder}
            handleNameBlur={subs.handleNameBlur}
            handleSelectAppResult={subs.handleSelectAppResult}
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
            spendingHistory={subs.spendingHistory}
            currency={currency}
            appLogoCache={appLogoCache}
            handleToggleChargePaid={calendar.handleToggleChargePaid}
          />
        )}
        {activeView === 'settings' && (
          <SettingsView
            isGroupProfileActive={groups.isGroupProfileActive}
            activeProfileContext={groups.activeProfileContext}
            groups={groups.groups}
            currency={currency}
            setCurrency={setCurrency}
            theme={theme}
            setTheme={setTheme}
            notificationsEnabled={notificationsEnabled}
            setNotificationsEnabled={setNotificationsEnabled}
            defaultReminder={defaultReminder}
            setDefaultReminder={setDefaultReminder}
            pwaPrompt={pwaPrompt}
            setPwaPrompt={setPwaPrompt}
            showInstallHelp={showInstallHelp}
            setShowInstallHelp={setShowInstallHelp}
            handleChangeProfileContext={groups.handleChangeProfileContext}
            handleExport={subs.handleExport}
            handleLogout={auth.handleLogout}
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
          <Plus size={22} strokeWidth={2} />
        </button>
        <button type="button" onClick={() => setActiveView('timeline')} className={activeView === 'timeline' ? 'active' : ''} aria-current={activeView === 'timeline' ? 'page' : undefined}>
          <CalendarDays size={20} strokeWidth={activeView === 'timeline' ? 2.2 : 1.6} />
          <span>Fechas</span>
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
    </main>
  )
}

export default App
