'use client';

/**
 * Video Call Container
 * Main layout wrapper for the video call page
 * Handles responsive layout with optional sidebar
 */
export default function VideoCallContainer({
  children,
  showSidebar = false,
  sidebarContent,
  sidebarTitle = 'Panel',
  onCloseSidebar,
  // For tabbed sidebar
  enabledPanels = [],
  activeTab,
  onTabChange,
}) {
  const hasTabs = enabledPanels.length > 1;

  return (
    <div className="h-screen bg-stone-900 flex flex-col overflow-hidden">
      {children}

      {/* Sidebar */}
      {showSidebar && (
        <div className="fixed right-0 top-0 bottom-0 w-full md:w-80 bg-stone-800 border-l border-stone-700 flex flex-col z-50">
          {/* Sidebar Header */}
          <div className="border-b border-stone-700">
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              <h3 className="text-white font-semibold">
                {hasTabs ? 'Meeting Panel' : sidebarTitle}
              </h3>
              {onCloseSidebar && (
                <button
                  onClick={onCloseSidebar}
                  className="text-stone-400 hover:text-white p-1"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Tabs */}
            {hasTabs && (
              <div className="flex">
                {enabledPanels.includes('messages') && (
                  <TabButton
                    active={activeTab === 'messages'}
                    onClick={() => onTabChange?.('messages')}
                    icon="💬"
                    label="Messages"
                    activeColor="amber"
                  />
                )}
                {enabledPanels.includes('topics') && (
                  <TabButton
                    active={activeTab === 'topics'}
                    onClick={() => onTabChange?.('topics')}
                    icon="💡"
                    label="Topics"
                    activeColor="amber"
                  />
                )}
                {enabledPanels.includes('participants') && (
                  <TabButton
                    active={activeTab === 'participants'}
                    onClick={() => onTabChange?.('participants')}
                    icon="👥"
                    label="People"
                    activeColor="amber"
                  />
                )}
              </div>
            )}
          </div>

          {/* Sidebar Content */}
          {sidebarContent}
        </div>
      )}
    </div>
  );
}

/**
 * Tab Button Component
 */
function TabButton({ active, onClick, icon, label, activeColor = 'amber', badge }) {
  const colorClasses = {
    amber: 'text-amber-400',
    mocha: 'text-amber-400',
  };

  const borderColorClasses = {
    amber: 'bg-amber-500',
    mocha: 'bg-amber-500',
  };

  return (
    <button
      onClick={onClick}
      className={`flex-1 py-3 text-sm font-medium transition relative ${
        active
          ? colorClasses[activeColor] || colorClasses.amber
          : 'text-stone-400 hover:text-white'
      }`}
    >
      {icon} {label}
      {badge && (
        <span className="absolute top-2 right-2 bg-red-600 text-white text-xs w-4 h-4 flex items-center justify-center rounded-full text-[10px]">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
      {active && (
        <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${borderColorClasses[activeColor] || borderColorClasses.amber}`} />
      )}
    </button>
  );
}
