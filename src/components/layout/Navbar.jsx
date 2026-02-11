import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Vote, FileText, User, Menu, X, ShieldAlert } from 'lucide-react';
import { useState } from 'react';

const Navbar = () => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <nav className="bg-gray-900 border-b border-[#D90F74]/30 sticky top-0 z-50 backdrop-blur-md bg-opacity-80">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center">
                        <Link to="/" className="flex-shrink-0 flex items-center gap-2">
                            <img src="https://igjedwdxqwkpbgrmtrrq.supabase.co/storage/v1/object/public/evidence/others/partidos%20politicos/ine4.png" alt="INE Logo" className="h-10 w-auto" />
                        </Link>
                    </div>
                    <div className="hidden md:block">
                        <div className="ml-10 flex items-baseline space-x-4">
                            <Link to="/" className="text-gray-300 hover:text-[#D90F74] px-3 py-2 rounded-md text-sm font-medium transition-colors">Inicio</Link>
                            <Link to="/votaciones" className="bg-[#D90F74] hover:bg-[#b00c5e] text-white px-4 py-2 rounded-md text-sm font-bold transition-colors shadow-lg flex items-center gap-2">
                                <Vote size={18} />
                                Votaciones
                            </Link>
                            <Link to="/admin/elecciones" className="text-gray-300 hover:text-[#D90F74] px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1">
                                <ShieldCheck size={16} /> Panel de Administración
                            </Link>
                        </div>
                    </div>
                    <div className="-mr-2 flex md:hidden">
                        <button onClick={() => setIsOpen(!isOpen)} className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none">
                            {isOpen ? <X size={24} /> : <Menu size={24} />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile menu */}
            {isOpen && (
                <div className="md:hidden bg-gray-900 border-b border-gray-800">
                    <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
                        <Link to="/" onClick={() => setIsOpen(false)} className="text-gray-300 hover:text-[#D90F74] block px-3 py-2 rounded-md text-base font-medium">Inicio</Link>
                        <Link to="/votaciones" onClick={() => setIsOpen(false)} className="text-[#D90F74] font-bold block px-3 py-2 rounded-md text-base bg-gray-800">Votaciones</Link>
                        <Link to="/admin/elecciones" onClick={() => setIsOpen(false)} className="text-gray-300 hover:text-[#D90F74] block px-3 py-2 rounded-md text-base font-medium">Admin</Link>
                    </div>
                </div>
            )}
        </nav>
    );
};

export default Navbar;
