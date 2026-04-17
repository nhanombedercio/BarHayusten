interface TopBarProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function TopBar({ title, subtitle, actions }: TopBarProps) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 flex-shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-1 h-8 rounded-full flex-shrink-0" style={{ background: 'linear-gradient(180deg, #1E9FD4, #00C8C8)' }}></div>
        <div>
          <h2 className="text-gray-900 font-semibold text-lg leading-none">{title}</h2>
          {subtitle && <p className="text-gray-400 text-xs mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="flex items-center gap-4">
        {actions}
        <div className="text-right hidden sm:block">
          <p className="text-gray-900 text-sm font-medium">{timeStr}</p>
          <p className="text-gray-400 text-xs capitalize">{dateStr}</p>
        </div>
        <button className="relative w-9 h-9 flex items-center justify-center bg-gray-50 rounded-lg hover:bg-gray-100 transition-all cursor-pointer">
          <i className="ri-notification-3-line text-gray-500 text-base"></i>
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ background: '#F5A623' }}></span>
        </button>
      </div>
    </div>
  );
}
