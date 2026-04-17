interface StatCardProps {
  label: string;
  value: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  trend?: { value: string; positive: boolean };
  subtitle?: string;
}

export default function StatCard({ label, value, icon, iconBg, iconColor, trend, subtitle }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl p-5 border border-gray-100">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">{label}</p>
          <p className="text-gray-900 text-2xl font-bold mt-1">{value}</p>
          {subtitle && <p className="text-gray-400 text-xs mt-0.5">{subtitle}</p>}
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              <div className={`w-4 h-4 flex items-center justify-center`}>
                <i className={`${trend.positive ? 'ri-arrow-up-line text-emerald-500' : 'ri-arrow-down-line text-red-500'} text-xs`}></i>
              </div>
              <span className={`text-xs font-medium ${trend.positive ? 'text-emerald-500' : 'text-red-500'}`}>
                {trend.value}
              </span>
              <span className="text-gray-400 text-xs">vs ontem</span>
            </div>
          )}
        </div>
        <div className={`w-11 h-11 flex items-center justify-center ${iconBg} rounded-xl flex-shrink-0`}>
          <i className={`${icon} ${iconColor} text-xl`}></i>
        </div>
      </div>
    </div>
  );
}
