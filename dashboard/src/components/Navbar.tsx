import Link from 'next/link'
import { BarChart3, Users, Building2, ArrowLeftRight } from 'lucide-react'

export default function Navbar() {
    return (
        <nav className="bg-gradient-to-r from-gray-900 to-gray-800 border-b border-gray-700">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center">
                        <Link href="/" className="flex items-center space-x-2">
                            <BarChart3 className="h-8 w-8 text-yellow-500" />
                            <span className="text-white font-bold text-xl">NacionMX Admin</span>
                        </Link>

                        <div className="hidden md:block ml-10">
                            <div className="flex items-baseline space-x-4">
                                <Link
                                    href="/"
                                    className="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition"
                                >
                                    Dashboard
                                </Link>
                                <Link
                                    href="/transactions"
                                    className="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition flex items-center gap-2"
                                >
                                    <ArrowLeftRight className="h-4 w-4" />
                                    Transacciones
                                </Link>
                                <Link
                                    href="/users"
                                    className="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition flex items-center gap-2"
                                >
                                    <Users className="h-4 w-4" />
                                    Usuarios
                                </Link>
                                <Link
                                    href="/companies"
                                    className="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition flex items-center gap-2"
                                >
                                    <Building2 className="h-4 w-4" />
                                    Empresas
                                </Link>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center">
                        <span className="text-gray-300 text-sm">
                            🟢 Online
                        </span>
                    </div>
                </div>
            </div>
        </nav>
    )
}
