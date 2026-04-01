'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Calendar, Compass, Users, Search } from 'lucide-react'
import { fonts } from '@/lib/designTokens'

/**
 * AppNavBar — sticky header with logo, search, profile avatar, and tab navigation.
 *
 * Uses usePathname() for active tab highlighting (file-based routing).
 * Search bar and results are optional — only shown when props are provided.
 */
export default function AppNavBar({
  currentUser,
  // Search (optional — only used on home page)
  searchQuery,
  onSearchChange,
  searchResults,
  onNavigate,
}) {
  const pathname = usePathname()

  const isActive = (path) => {
    if (path === '/home') return pathname === '/home' || pathname === '/'
    // /circles/browse is "All Circles" from Discover, not the Circles tab
    if (path === '/circles' && pathname === '/circles/browse') return false
    return pathname.startsWith(path)
  }

  const tabs = [
    { path: '/home', label: 'Home', icon: Calendar },
    { path: '/discover', label: 'Discover', icon: Compass },
    { path: '/coffee', label: 'Coffee', icon: Calendar },
    { path: '/circles', label: 'Circles', icon: Users },
  ]

  return (
    <header
      className="sticky top-0 z-50"
      style={{
        backgroundColor: 'rgba(250, 245, 239, 0.85)',
        backdropFilter: 'blur(20px) saturate(1.2)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.2)',
        borderBottom: '1px solid rgba(184, 160, 137, 0.12)'
      }}
    >
      {/* Line 1: Logo + Search + Profile */}
      <div className="max-w-4xl mx-auto px-4 pt-4 pb-2 md:px-6">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link
            href="/home"
            className="text-xl md:text-2xl font-bold flex items-center text-[#5E4530] no-underline"
            style={{ fontFamily: fonts.serif, letterSpacing: '-0.3px' }}
            aria-label="CircleW"
          >
            <svg width="44" height="44" viewBox="0 0 100 100" className="mr-2 md:mr-3 md:w-12 md:h-12">
              <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="5" strokeDasharray="189 63" strokeLinecap="round" transform="rotate(-30 50 50)" />
              <path d="M 28 42 L 36 66 L 50 48 L 64 66 L 72 42" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ letterSpacing: '0.5px', transform: 'scaleY(0.92)', transformOrigin: 'bottom', display: 'inline-block' }}>CircleW</span>
            </div>
          </Link>

          {/* Right side: Search + Profile */}
          <div className="flex items-center gap-3">
            {/* Search (only rendered when search props are provided) */}
            {onSearchChange && (
              <div className="relative" style={{ zIndex: 50 }}>
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B8A089]" style={{ zIndex: 1 }} />
                <input
                  type="text"
                  placeholder="Search meetups, people, circles..."
                  value={searchQuery || ''}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="pl-10 pr-4 py-2.5 w-36 md:w-[200px] text-[13px] rounded-full border border-[#E8DDD0] bg-white text-[#5E4530] placeholder-[#B8A089] focus:outline-none md:focus:w-[260px] focus:border-[#B8A089] transition-all duration-300"
                  style={{ boxShadow: 'none' }}
                  onFocus={(e) => { e.target.style.boxShadow = '0 0 0 3px rgba(122,92,66,0.08)' }}
                  onBlur={(e) => { setTimeout(() => { e.target.style.boxShadow = 'none'; onSearchChange('') }, 400) }}
                />
                {searchResults && searchQuery && (
                  <SearchDropdown results={searchResults} query={searchQuery} onNavigate={onNavigate} onClear={() => onSearchChange('')} />
                )}
              </div>
            )}

            {/* Profile Avatar */}
            <Link
              href="/profile"
              className="w-10 h-10 md:w-11 md:h-11 rounded-full flex items-center justify-center text-lg font-bold transition-all hover:ring-2 hover:ring-[#8B6F5C] focus:outline-none focus:ring-2 focus:ring-[#8B6F5C]"
              style={{ backgroundColor: currentUser.profile_picture ? 'transparent' : '#E6D5C3' }}
            >
              {currentUser.profile_picture ? (
                <img src={currentUser.profile_picture} alt="Profile" className="w-full h-full rounded-full object-cover" />
              ) : (
                <span className="text-[#5C4033]">
                  {(currentUser.name || currentUser.email?.split('@')[0] || 'U').charAt(0).toUpperCase()}
                </span>
              )}
            </Link>
          </div>
        </div>
      </div>

      {/* Line 2: Tab Navigation */}
      <div>
        <div className="max-w-4xl mx-auto px-2 md:px-6">
          <div className="flex items-center gap-1 py-1.5">
            {tabs.map(({ path, label, icon: Icon }) => (
              <Link
                key={path}
                href={path}
                className={`flex-1 md:flex-none flex items-center justify-center gap-[5px] md:gap-[7px] px-3 md:px-4 py-3 text-xs md:text-sm font-medium whitespace-nowrap rounded-full transition-all duration-[250ms] min-h-[44px] no-underline ${
                  isActive(path)
                    ? 'bg-[#5E4530] text-[#FAF5EF]'
                    : 'text-[#9C8068] hover:text-[#5E4530] hover:bg-[#E8DDD0]'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </header>
  )
}

/**
 * Search results dropdown — extracted for readability.
 */
function SearchDropdown({ results, query, onNavigate, onClear }) {
  const handleClick = (view, data) => {
    onClear()
    if (onNavigate) onNavigate(view, data)
  }

  return (
    <div style={{
      position: 'absolute', top: '100%', right: 0, marginTop: '8px',
      width: '320px', maxHeight: '400px', overflowY: 'auto',
      background: 'white', borderRadius: '16px',
      boxShadow: '0 8px 32px rgba(59,35,20,0.15)', border: '1px solid #E8DDD0',
      padding: '8px 0',
    }}>
      {results.total === 0 ? (
        <div style={{ padding: '20px', textAlign: 'center', color: '#9B8A7E', fontSize: '13px', fontFamily: fonts.sans }}>
          No results for &ldquo;{query}&rdquo;
        </div>
      ) : (
        <>
          {results.meetups?.length > 0 && (
            <>
              <div style={{ padding: '8px 16px 4px', fontSize: '10px', fontWeight: '700', color: '#9B8A7E', textTransform: 'uppercase', letterSpacing: '1px', fontFamily: fonts.sans }}>Meetups</div>
              {results.meetups.map(m => (
                <div key={m.id} onClick={() => handleClick('eventDetail', { meetupId: m.id })}
                  style={{ padding: '10px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#FAF5EF'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#F3EAE0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Calendar style={{ width: '16px', height: '16px', color: '#8B6347' }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#3B2314', fontFamily: fonts.sans, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.topic}</div>
                  </div>
                </div>
              ))}
            </>
          )}
          {results.circles?.length > 0 && (
            <>
              <div style={{ padding: '8px 16px 4px', fontSize: '10px', fontWeight: '700', color: '#9B8A7E', textTransform: 'uppercase', letterSpacing: '1px', fontFamily: fonts.sans }}>Circles</div>
              {results.circles.map(c => (
                <div key={c.id} onClick={() => handleClick('circleDetail', { circleId: c.id })}
                  style={{ padding: '10px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#FAF5EF'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#EDE4D8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Users style={{ width: '16px', height: '16px', color: '#7A5C42' }} />
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#3B2314', fontFamily: fonts.sans }}>{c.name}</div>
                </div>
              ))}
            </>
          )}
          {results.people?.length > 0 && (
            <>
              <div style={{ padding: '8px 16px 4px', fontSize: '10px', fontWeight: '700', color: '#9B8A7E', textTransform: 'uppercase', letterSpacing: '1px', fontFamily: fonts.sans }}>People</div>
              {results.people.map(p => (
                <div key={p.id} onClick={() => handleClick('userProfile', { userId: p.id })}
                  style={{ padding: '10px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#FAF5EF'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {p.profile_picture ? (
                    <img src={p.profile_picture} alt="" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#E6D5C3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '13px', fontWeight: '600', color: '#6B4632', fontFamily: fonts.sans }}>
                      {(p.name || '?').split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#3B2314', fontFamily: fonts.sans }}>{p.name}</div>
                    {p.career && <div style={{ fontSize: '11px', color: '#9B8A7E', fontFamily: fonts.sans, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.career}</div>}
                  </div>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </div>
  )
}
