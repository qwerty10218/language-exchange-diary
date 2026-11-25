import { useEffect, useState } from 'react';
import {
  isIosSafari,
  isStandaloneMode,
  loadPwaDismissed,
  registerAppServiceWorker,
  savePwaDismissed,
} from './pwa.mjs';
import { useChinese } from './Chinese';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export default function PwaBanner() {
  const { t } = useChinese();
  const [applyUpdate, setApplyUpdate] = useState<(() => void) | null>(null);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(loadPwaDismissed(() => window.localStorage));
    if (!isStandaloneMode(window) && isIosSafari(navigator.userAgent)) {
      setShowIosGuide(true);
    }
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstallEvent(null);
      setShowIosGuide(false);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    let cleanupSw = () => {};
    if (import.meta.env.PROD) {
      cleanupSw = registerAppServiceWorker(import.meta.env.BASE_URL, trigger => {
        setApplyUpdate(() => trigger);
      });
    }
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
      cleanupSw();
    };
  }, []);

  const dismiss = () => {
    savePwaDismissed(() => window.localStorage);
    setDismissed(true);
    setInstallEvent(null);
    setShowIosGuide(false);
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice.catch(() => ({ outcome: 'dismissed' as const }));
    if (choice.outcome === 'accepted') setInstallEvent(null);
  };

  if (applyUpdate) {
    return (
      <aside className="pwa-banner pwa-banner-update" role="status" aria-live="polite">
        <span>{t('有新詞庫或新版本可用，更新後即可使用最新內容。')}</span>
        <button type="button" className="primary-button" onClick={applyUpdate}>{t('立即更新')}</button>
      </aside>
    );
  }

  if (dismissed || (!installEvent && !showIosGuide)) return null;

  return (
    <aside className="pwa-banner" aria-label={t('加入手機主畫面')}>
      {installEvent ? (
        <>
          <span>{t('安裝「言語交換日記」到手機桌面，離線也能每天 3 分鐘練字闖關！')}</span>
          <div className="pwa-banner-actions">
            <button type="button" className="primary-button" onClick={install}>{t('加入主畫面')}</button>
            <button type="button" className="text-button" onClick={dismiss}>{t('稍後')}</button>
          </div>
        </>
      ) : (
        <>
          <span>{t('加到 iPhone 主畫面：點 Safari 底部「分享」→「加入主畫面」，離線全螢幕更好寫！')}</span>
          <button type="button" className="text-button" onClick={dismiss}>{t('知道了')}</button>
        </>
      )}
    </aside>
  );
}
