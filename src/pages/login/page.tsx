import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/store/AuthContext';
import { db, AppUserDB } from '@/store/db';

type LoginView = 'login' | 'recovery-request' | 'recovery-verify' | 'recovery-reset';

const RECOVERY_PHONE = '842638013';
const RECOVERY_PHONE_DISPLAY = '+258 84 263 8013';

export default function LoginPage() {
  const { login, isLoggedIn } = useAuth();
  const navigate = useNavigate();

  const REMEMBER_KEY = 'barone_remember_username';

  // Login state
  const [username, setUsername] = useState(() => localStorage.getItem(REMEMBER_KEY) || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberUser, setRememberUser] = useState(() => !!localStorage.getItem(REMEMBER_KEY));

  // Recovery state
  const [view, setView] = useState<LoginView>('login');
  const [recoveryUsername, setRecoveryUsername] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoveryError, setRecoveryError] = useState('');
  const [recoverySuccess, setRecoverySuccess] = useState('');
  const [codeSent, setCodeSent] = useState(false);

  // If already logged in, redirect to dashboard
  if (isLoggedIn) {
    navigate('/', { replace: true });
    return null;
  }

  const getErrorMessage = (att: number): string => {
    if (att === 1) return 'Utilizador ou senha incorretos. Verifique e tente novamente.';
    if (att === 2) return 'Credenciais incorretas de novo. Tem a certeza que são os dados certos?';
    if (att >= 3) return `Credenciais incorretas (${att} tentativas). Use "Recuperar Senha" se não se lembrar.`;
    return 'Utilizador ou senha incorretos. Tente novamente.';
  };

  const findUserByName = (name: string): AppUserDB | undefined => {
    // Use cached users from localStorage for sync recovery flow
    const cached = db.getUsersSync();
    return cached.find(u => u.active && u.name.toLowerCase() === name.trim().toLowerCase());
  };

  const handleLogin = async () => {
    if (!username.trim()) { setError('Introduza o seu nome de utilizador.'); return; }
    if (!password) { setError('Introduza a sua senha para continuar.'); return; }
    setLoading(true);
    setError('');
    try {
      const ok = await login(username, password);
      if (!ok) {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        setError(getErrorMessage(newAttempts));
        setPassword('');
        setLoading(false);
      } else {
        if (rememberUser) {
          localStorage.setItem(REMEMBER_KEY, username.trim());
        } else {
          localStorage.removeItem(REMEMBER_KEY);
        }
        navigate('/', { replace: true });
      }
    } catch {
      setError('Erro de ligação. Verifique a sua ligação à internet.');
      setLoading(false);
    }
  };

  // Generate 8-digit code
  const generateCode = (): string => {
    return Math.floor(10000000 + Math.random() * 90000000).toString();
  };

  const handleSendCode = () => {
    if (!recoveryUsername.trim()) { setRecoveryError('Introduza o seu nome de utilizador.'); return; }
    const user = findUserByName(recoveryUsername);
    if (!user) { setRecoveryError('Utilizador não encontrado. Verifique o nome e tente novamente.'); return; }
    const code = generateCode();
    setGeneratedCode(code);
    const msg = encodeURIComponent(
      `Hayusten BarOne - Recuperação de Senha\n\nOlá ${user.name}!\n\nO seu código de recuperação é:\n*${code}*\n\nEste código é válido por 10 minutos.\nSe não pediu esta recuperação, ignore esta mensagem.`
    );
    const waUrl = `https://wa.me/${RECOVERY_PHONE}?text=${msg}`;
    window.open(waUrl, '_blank');
    setCodeSent(true);
    setRecoveryError('');
    setView('recovery-verify');
  };

  const handleVerifyCode = () => {
    if (!recoveryCode) { setRecoveryError('Introduza o código recebido no WhatsApp.'); return; }
    if (recoveryCode.trim() !== generatedCode) {
      setRecoveryError('Código incorreto. Verifique o WhatsApp e tente novamente.');
      return;
    }
    setRecoveryError('');
    setView('recovery-reset');
  };

  const handleResetPassword = async () => {
    if (!newPassword) { setRecoveryError('Introduza a nova senha.'); return; }
    if (newPassword.length < 4) { setRecoveryError('A senha deve ter pelo menos 4 caracteres.'); return; }
    if (newPassword !== confirmPassword) { setRecoveryError('As senhas não coincidem. Verifique e tente novamente.'); return; }
    const user = findUserByName(recoveryUsername);
    if (!user) { setRecoveryError('Utilizador não encontrado.'); return; }
    try {
      const allUsers = await db.getUsers();
      const updated = allUsers.map(u => u.id === user.id ? { ...u, password: newPassword } : u);
      await db.setUsers(updated);
      setRecoverySuccess('Senha alterada com sucesso! Já pode entrar com a nova senha.');
      setTimeout(() => {
        setView('login');
        setUsername(user.name);
        setRecoveryUsername('');
        setRecoveryCode('');
        setGeneratedCode('');
        setNewPassword('');
        setConfirmPassword('');
        setRecoverySuccess('');
        setCodeSent(false);
        setAttempts(0);
        setError('');
      }, 2500);
    } catch {
      setRecoveryError('Erro ao guardar a nova senha. Tente novamente.');
    }
  };

  const resetRecovery = () => {
    setView('login');
    setRecoveryUsername('');
    setRecoveryCode('');
    setGeneratedCode('');
    setNewPassword('');
    setConfirmPassword('');
    setRecoveryError('');
    setRecoverySuccess('');
    setCodeSent(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0D1B2A' }}>
      <div className="w-full max-w-md px-6">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="w-14 h-14 flex items-center justify-center">
              <svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-14 h-14">
                <rect x="4" y="8" width="12" height="36" rx="6" fill="#1E9FD4"/>
                <rect x="44" y="8" width="12" height="36" rx="6" fill="#00C8C8"/>
                <rect x="4" y="22" width="52" height="12" rx="6" fill="#1E9FD4"/>
                <rect x="22" y="46" width="10" height="10" rx="2" fill="#F5A623"/>
              </svg>
            </div>
            <div className="text-left">
              <p className="text-white font-bold text-2xl leading-tight tracking-wide">Hayusten</p>
              <p className="text-lg font-semibold" style={{ color: '#F5A623' }}>BarOne</p>
            </div>
          </div>
          <p className="text-gray-400 text-sm">Sistema de Gestão de Bar</p>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-2xl">

          {/* ── LOGIN VIEW ── */}
          {view === 'login' && (
            <>
              <h2 className="text-gray-900 font-bold text-xl mb-1">Entrar no Sistema</h2>
              <p className="text-gray-400 text-sm mb-6">Introduza o seu utilizador e senha</p>

              {/* Username */}
              <div className="mb-4">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2 block">Nome de Utilizador</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-gray-400">
                    <i className="ri-user-line text-base"></i>
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={e => { setUsername(e.target.value); setError(''); }}
                    onKeyDown={e => e.key === 'Enter' && handleLogin()}
                    placeholder="Ex: Admin"
                    className={`w-full border rounded-xl pl-9 pr-4 py-3 text-sm focus:outline-none transition-all ${
                      error ? 'border-red-400 bg-red-50 focus:border-red-400' : 'border-gray-200 focus:border-cyan-400'
                    }`}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="mb-2">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2 block">Senha</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-gray-400">
                    <i className="ri-lock-line text-base"></i>
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(''); }}
                    onKeyDown={e => e.key === 'Enter' && handleLogin()}
                    placeholder="Introduza a sua senha..."
                    className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none transition-all pr-11 ${
                      error ? 'border-red-400 bg-red-50 focus:border-red-400' : 'border-gray-200 focus:border-cyan-400'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    <i className={showPassword ? 'ri-eye-off-line' : 'ri-eye-line'}></i>
                  </button>
                </div>
              </div>

              {/* Remember user */}
              <div className="flex items-center gap-2 mb-4 mt-1">
                <button
                  type="button"
                  onClick={() => setRememberUser(v => !v)}
                  className={`w-5 h-5 flex items-center justify-center rounded border-2 transition-all cursor-pointer flex-shrink-0 ${
                    rememberUser ? 'border-cyan-500 bg-cyan-500' : 'border-gray-300 bg-white'
                  }`}
                >
                  {rememberUser && <i className="ri-check-line text-white text-xs"></i>}
                </button>
                <span
                  onClick={() => setRememberUser(v => !v)}
                  className="text-xs text-gray-500 cursor-pointer select-none"
                >
                  Lembrar o meu nome de utilizador neste computador
                </span>
              </div>

              {/* Error message */}
              {error && (
                <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                  <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <i className="ri-error-warning-fill text-red-500 text-sm"></i>
                  </div>
                  <p className="text-red-600 text-xs leading-relaxed">{error}</p>
                </div>
              )}

              {/* Attempts warning */}
              {attempts >= 2 && !error && (
                <div className="mb-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                  <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <i className="ri-alert-line text-amber-500 text-sm"></i>
                  </div>
                  <p className="text-amber-700 text-xs leading-relaxed">Muitas tentativas falhadas. Clique em &quot;Recuperar Senha&quot; se não se lembrar.</p>
                </div>
              )}

              <button
                onClick={handleLogin}
                disabled={loading || !username.trim() || !password}
                className="w-full py-3.5 text-white rounded-xl font-semibold text-sm cursor-pointer whitespace-nowrap disabled:opacity-40 transition-all hover:opacity-90 mt-3 mb-4"
                style={{ background: 'linear-gradient(135deg, #1E9FD4, #00C8C8)' }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <i className="ri-loader-4-line animate-spin"></i> A entrar...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <i className="ri-login-box-line"></i> Entrar
                  </span>
                )}
              </button>

              {/* Recovery link */}
              <div className="text-center border-t border-gray-100 pt-4">
                <button
                  onClick={() => { setView('recovery-request'); setRecoveryError(''); }}
                  className="text-xs text-cyan-600 hover:text-cyan-700 font-medium cursor-pointer underline underline-offset-2"
                >
                  <i className="ri-lock-unlock-line mr-1"></i>
                  Esqueci a senha — Recuperar via WhatsApp
                </button>
              </div>
            </>
          )}

          {/* ── RECOVERY REQUEST VIEW ── */}
          {view === 'recovery-request' && (
            <>
              <div className="flex items-center gap-3 mb-5">
                <button onClick={resetRecovery} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 cursor-pointer text-gray-500">
                  <i className="ri-arrow-left-line"></i>
                </button>
                <div>
                  <h2 className="text-gray-900 font-bold text-xl leading-tight">Recuperar Senha</h2>
                  <p className="text-gray-400 text-xs">Enviaremos um código de 8 dígitos para WhatsApp</p>
                </div>
              </div>

              {/* WhatsApp info */}
              <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-5">
                <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                  <i className="ri-whatsapp-line text-emerald-600 text-xl"></i>
                </div>
                <div>
                  <p className="text-emerald-800 text-xs font-semibold">Código enviado para WhatsApp</p>
                  <p className="text-emerald-600 text-xs">{RECOVERY_PHONE_DISPLAY}</p>
                </div>
              </div>

              {/* Username input */}
              <div className="mb-5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2 block">Nome de Utilizador</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-gray-400">
                    <i className="ri-user-line text-base"></i>
                  </div>
                  <input
                    type="text"
                    value={recoveryUsername}
                    onChange={e => { setRecoveryUsername(e.target.value); setRecoveryError(''); }}
                    onKeyDown={e => e.key === 'Enter' && handleSendCode()}
                    placeholder="Ex: Admin"
                    className={`w-full border rounded-xl pl-9 pr-4 py-3 text-sm focus:outline-none transition-all ${
                      recoveryError ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-cyan-400'
                    }`}
                  />
                </div>
              </div>

              {recoveryError && (
                <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                  <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <i className="ri-error-warning-fill text-red-500 text-sm"></i>
                  </div>
                  <p className="text-red-600 text-xs">{recoveryError}</p>
                </div>
              )}

              <button
                onClick={handleSendCode}
                disabled={!recoveryUsername.trim()}
                className="w-full py-3.5 text-white rounded-xl font-semibold text-sm cursor-pointer whitespace-nowrap disabled:opacity-40 transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #25D366, #128C7E)' }}
              >
                <span className="flex items-center justify-center gap-2">
                  <i className="ri-whatsapp-line"></i> Enviar Código via WhatsApp
                </span>
              </button>
            </>
          )}

          {/* ── RECOVERY VERIFY VIEW ── */}
          {view === 'recovery-verify' && (
            <>
              <div className="flex items-center gap-3 mb-5">
                <button onClick={() => setView('recovery-request')} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 cursor-pointer text-gray-500">
                  <i className="ri-arrow-left-line"></i>
                </button>
                <div>
                  <h2 className="text-gray-900 font-bold text-xl leading-tight">Verificar Código</h2>
                  <p className="text-gray-400 text-xs">Introduza o código de 8 dígitos recebido</p>
                </div>
              </div>

              {codeSent && (
                <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-5">
                  <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <i className="ri-checkbox-circle-fill text-emerald-500"></i>
                  </div>
                  <div>
                    <p className="text-emerald-800 text-xs font-semibold">Código enviado!</p>
                    <p className="text-emerald-600 text-xs">Verifique o WhatsApp em {RECOVERY_PHONE_DISPLAY} e copie o código de 8 dígitos.</p>
                  </div>
                </div>
              )}

              <div className="mb-5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2 block">Código de Recuperação (8 dígitos)</label>
                <input
                  type="text"
                  value={recoveryCode}
                  onChange={e => { setRecoveryCode(e.target.value.replace(/\D/g, '').slice(0, 8)); setRecoveryError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleVerifyCode()}
                  placeholder="Ex: 47382910"
                  maxLength={8}
                  className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none transition-all font-mono tracking-widest text-center text-lg ${
                    recoveryError ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-cyan-400'
                  }`}
                />
                <p className="text-gray-400 text-xs mt-1.5 text-center">{recoveryCode.length}/8 dígitos</p>
              </div>

              {recoveryError && (
                <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                  <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <i className="ri-error-warning-fill text-red-500 text-sm"></i>
                  </div>
                  <p className="text-red-600 text-xs">{recoveryError}</p>
                </div>
              )}

              <button
                onClick={handleVerifyCode}
                disabled={recoveryCode.length !== 8}
                className="w-full py-3.5 text-white rounded-xl font-semibold text-sm cursor-pointer whitespace-nowrap disabled:opacity-40 transition-all hover:opacity-90 mb-3"
                style={{ background: 'linear-gradient(135deg, #1E9FD4, #00C8C8)' }}
              >
                <span className="flex items-center justify-center gap-2">
                  <i className="ri-shield-check-line"></i> Verificar Código
                </span>
              </button>

              <button
                onClick={() => { setView('recovery-request'); setRecoveryCode(''); setRecoveryError(''); setCodeSent(false); }}
                className="w-full py-2.5 text-gray-500 rounded-xl text-xs cursor-pointer whitespace-nowrap hover:bg-gray-50 transition-all border border-gray-200"
              >
                Não recebi o código — Reenviar
              </button>
            </>
          )}

          {/* ── RECOVERY RESET VIEW ── */}
          {view === 'recovery-reset' && (
            <>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 flex items-center justify-center rounded-full bg-emerald-100 flex-shrink-0">
                  <i className="ri-shield-check-fill text-emerald-600 text-lg"></i>
                </div>
                <div>
                  <h2 className="text-gray-900 font-bold text-xl leading-tight">Nova Senha</h2>
                  <p className="text-gray-400 text-xs">Código verificado! Defina a nova senha</p>
                </div>
              </div>

              {recoverySuccess && (
                <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-3 mb-4">
                  <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <i className="ri-checkbox-circle-fill text-emerald-500"></i>
                  </div>
                  <p className="text-emerald-700 text-xs font-medium">{recoverySuccess}</p>
                </div>
              )}

              <div className="mb-4">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2 block">Nova Senha</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => { setNewPassword(e.target.value); setRecoveryError(''); }}
                  placeholder="Mínimo 4 caracteres..."
                  className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none transition-all ${
                    recoveryError ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-cyan-400'
                  }`}
                />
              </div>

              <div className="mb-4">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2 block">Confirmar Nova Senha</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); setRecoveryError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleResetPassword()}
                  placeholder="Repita a nova senha..."
                  className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none transition-all ${
                    recoveryError ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-cyan-400'
                  }`}
                />
                {confirmPassword && newPassword && (
                  <p className={`text-xs mt-1.5 flex items-center gap-1 ${newPassword === confirmPassword ? 'text-emerald-600' : 'text-red-500'}`}>
                    <i className={newPassword === confirmPassword ? 'ri-checkbox-circle-line' : 'ri-close-circle-line'}></i>
                    {newPassword === confirmPassword ? 'As senhas coincidem' : 'As senhas não coincidem'}
                  </p>
                )}
              </div>

              {recoveryError && (
                <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                  <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <i className="ri-error-warning-fill text-red-500 text-sm"></i>
                  </div>
                  <p className="text-red-600 text-xs">{recoveryError}</p>
                </div>
              )}

              <button
                onClick={handleResetPassword}
                disabled={!newPassword || !confirmPassword || !!recoverySuccess}
                className="w-full py-3.5 text-white rounded-xl font-semibold text-sm cursor-pointer whitespace-nowrap disabled:opacity-40 transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #1E9FD4, #00C8C8)' }}
              >
                <span className="flex items-center justify-center gap-2">
                  <i className="ri-save-line"></i> Guardar Nova Senha
                </span>
              </button>
            </>
          )}

        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          Hayusten BarOne &copy; {new Date().getFullYear()} — Maputo, Moçambique
        </p>
      </div>
    </div>
  );
}
