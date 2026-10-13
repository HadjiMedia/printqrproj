import { useState, useEffect } from 'react';
import { 
  Send, 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  Trash2, 
  ShieldCheck, 
  RefreshCw, 
  ExternalLink,
  Lock,
  Bot
} from 'lucide-react';
import { getTelegramStatusApi, testTelegramApi, triggerCleanupApi } from '../services/api';

export function TelegramPanel() {
  const [status, setStatus] = useState<{ configured: boolean; hasToken: boolean; hasChatId: boolean }>({
    configured: false,
    hasToken: false,
    hasChatId: false,
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; botInfo?: any } | null>(null);
  const [cleaning, setCleaning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<any | null>(null);

  useEffect(() => {
    getTelegramStatusApi().then(setStatus).catch(() => {});
  }, []);

  const handleTestPing = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testTelegramApi();
      setTestResult(res);
      const st = await getTelegramStatusApi();
      setStatus(st);
    } catch (e: any) {
      setTestResult({
        success: false,
        message: e.message || 'Failed connecting to server Telegram endpoint.',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleManualCleanup = async () => {
    setCleaning(true);
    setCleanupResult(null);
    try {
      const res = await triggerCleanupApi();
      setCleanupResult(res);
    } catch (e: any) {
      setCleanupResult({ error: e.message });
    } finally {
      setCleaning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-white rounded-2xl p-6 border border-[#D4DDD5] shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#eef4f1] text-[#23664B] text-xs font-semibold">
              <Bot className="w-3.5 h-3.5" />
              <span>Real Telegram Bot File Dispatch</span>
            </div>
            <h3 className="font-bold text-base text-[#20352A]">
              Telegram Bot API Integration & Storage Optimization
            </h3>
            <p className="text-xs text-[#5A6E64] max-w-2xl leading-relaxed">
              When configured on the server, incoming customer print files are automatically uploaded as attachments to your shop's private Telegram group. Staff can view and print documents directly from Telegram Desktop or mobile.
            </p>
          </div>

          <div className="shrink-0">
            {status.configured ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Telegram Configured & Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                <AlertTriangle className="w-3.5 h-3.5" />
                Unconfigured (Local Disk Storage Active)
              </span>
            )}
          </div>
        </div>

        {/* Section H Notice: Automatic File Cleanup */}
        <div className="p-4 rounded-xl bg-[#eef4f1]/70 border border-[#d6e6df] text-xs space-y-2">
          <div className="flex items-center gap-2 font-bold text-[#23664B]">
            <ShieldCheck className="w-4 h-4" />
            <span>Automatic Temporary File Cleanup (Section H Implemented)</span>
          </div>
          <p className="text-[#20352A] leading-relaxed">
            To prevent hosting disk exhaustion, <strong>temporary files on the website server are automatically deleted</strong> as soon as Telegram Bot confirms successful document delivery. The order metadata, queue ticket, printing specs, and total price remain permanently recorded in the database.
          </p>
          <div className="pt-2 flex items-center justify-between border-t border-[#d6e6df] text-[11px] text-[#5A6E64]">
            <span>Failed or unconfigured uploads are retained locally for a 24-hour recovery window.</span>
            <button
              type="button"
              onClick={handleManualCleanup}
              disabled={cleaning}
              className="inline-flex items-center gap-1 font-semibold text-[#23664B] hover:underline cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              <span>{cleaning ? 'Cleaning...' : 'Trigger Cleanup Now'}</span>
            </button>
          </div>
        </div>

        {cleanupResult && (
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900">
            {cleanupResult.error ? (
              <span>Error during cleanup: {cleanupResult.error}</span>
            ) : (
              <span>
                Cleanup completed: {cleanupResult.deletedDeliveredCount} delivered files and {cleanupResult.deletedOrphanCount} orphan files deleted. Freed {(cleanupResult.freedBytes / 1024 / 1024).toFixed(2)} MB of disk space.
              </span>
            )}
          </div>
        )}
      </div>

      {/* Real Test Ping & Server Configuration Instructions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Real Test Ping Box */}
        <div className="lg:col-span-6 bg-white rounded-2xl p-6 border border-[#D4DDD5] shadow-2xs space-y-4">
          <h4 className="font-bold text-sm text-[#20352A] flex items-center gap-2">
            <Send className="w-4 h-4 text-[#23664B]" />
            <span>Real Telegram Connection Test</span>
          </h4>

          <p className="text-xs text-[#5A6E64] leading-relaxed">
            Click below to send an actual test notification from your server to the configured Telegram destination. This will verify that your token is valid and the bot has permission to message your staff channel.
          </p>

          <button
            type="button"
            onClick={handleTestPing}
            disabled={testing}
            className="w-full py-2.5 px-4 rounded-xl bg-[#23664B] hover:bg-[#1b523c] text-white text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
          >
            {testing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Contacting Telegram API...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Send Real Telegram Test Notification</span>
              </>
            )}
          </button>

          {testResult && (
            <div
              className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                testResult.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold">
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                )}
                <span>{testResult.success ? 'Real Telegram API Success' : 'Telegram API Error'}</span>
              </div>
              <p className="leading-relaxed">{testResult.message}</p>
              {testResult.botInfo && (
                <p className="text-[11px] font-mono opacity-80">
                  Bot: @{testResult.botInfo.username} (ID: {testResult.botInfo.id})
                </p>
              )}
            </div>
          )}
        </div>

        {/* Server Setup Instructions */}
        <div className="lg:col-span-6 bg-white rounded-2xl p-6 border border-[#D4DDD5] shadow-2xs space-y-4">
          <h4 className="font-bold text-sm text-[#20352A] flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#23664B]" />
            <span>Server Environment Setup Guide</span>
          </h4>

          <ol className="space-y-2 text-xs text-[#5A6E64] list-decimal list-inside leading-relaxed">
            <li>
              <strong className="text-[#20352A]">Create Bot:</strong> Message <code className="bg-[#F7F8F5] px-1 py-0.5 rounded text-[#20352A]">@BotFather</code> on Telegram, send <code className="bg-[#F7F8F5] px-1 py-0.5 rounded text-[#20352A]">/newbot</code>, and copy your HTTP API token.
            </li>
            <li>
              <strong className="text-[#20352A]">Add Bot to Staff Group:</strong> Add the bot to your private shop group and promote it to Admin.
            </li>
            <li>
              <strong className="text-[#20352A]">Get Chat ID:</strong> Check your group chat ID (starts with <code className="bg-[#F7F8F5] px-1 py-0.5 rounded text-[#20352A]">-100...</code>).
            </li>
            <li>
              <strong className="text-[#20352A]">Configure Environment:</strong> Set in your hosting environment variables:
              <pre className="mt-1 p-2 rounded-lg bg-[#20352A] text-emerald-400 font-mono text-[11px] overflow-x-auto">
{`TELEGRAM_BOT_TOKEN="your_bot_token"
TELEGRAM_CHAT_ID="-1001234567890"`}
              </pre>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
