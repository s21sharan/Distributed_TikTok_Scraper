'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  Bars3Icon, 
  XMarkIcon,
  HomeIcon,
  QueueListIcon,
  CpuChipIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline'

const navigation = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
  { name: 'Queue', href: '/queue', icon: QueueListIcon },
  { name: 'Workers', href: '/workers', icon: CpuChipIcon },
  { name: 'Results', href: '/results', icon: DocumentTextIcon },
]

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const pathname = usePathname()

  return (
    <nav className="bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 shadow-lg">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="relative flex h-16 items-center justify-between">
          {/* Mobile menu button */}
          <div className="absolute inset-y-0 left-0 flex items-center sm:hidden">
            <button
              type="button"
              className="relative inline-flex items-center justify-center rounded-md p-2 text-white hover:bg-white/20 hover:text-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
              aria-controls="mobile-menu"
              aria-expanded="false"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <span className="absolute -inset-0.5" />
              <span className="sr-only">Open main menu</span>
              {mobileMenuOpen ? (
                <XMarkIcon className="block h-6 w-6" aria-hidden="true" />
              ) : (
                <Bars3Icon className="block h-6 w-6" aria-hidden="true" />
              )}
            </button>
          </div>

          {/* Logo and navigation */}
          <div className="flex flex-1 items-center justify-center sm:items-stretch sm:justify-start">
            <div className="hidden sm:ml-6 sm:block">
              <div className="flex space-x-4">
                {navigation.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`
                        flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors
                        ${isActive 
                          ? 'bg-white/20 text-white' 
                          : 'text-white/80 hover:bg-white/10 hover:text-white'
                        }
                      `}
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {item.name}
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="sm:hidden" id="mobile-menu">
          <div className="space-y-1 px-2 pb-3 pt-2">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`
                    flex items-center block px-3 py-2 rounded-md text-base font-medium transition-colors
                    ${isActive 
                      ? 'bg-white/20 text-white' 
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                    }
                  `}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <item.icon className="mr-2 h-5 w-5" />
                  {item.name}
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </nav>
  )
} 