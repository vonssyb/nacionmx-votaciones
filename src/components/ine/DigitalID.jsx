import React, { useState } from 'react';
// import { QRCodeSVG } from 'qrcode.react'; // Removed to avoid dependency issues
// Actually, looking at package.json earlier, I didn't see qrcode.react. I should verify or just use a placeholder API for now to avoid install issues unless I check.
// Let's use a simple img tag with a QR API for now to be safe and light.

const DigitalID = ({ userData, dniData, votes }) => {
    const [isFlipped, setIsFlipped] = useState(false);

    // Mock Data if missing
    const userAvatar = userData?.user_metadata?.avatar_url || userData?.avatar_url || "https://ui-avatars.com/api/?name=" + (dniData?.nombre || userData?.email || 'User');
    const name = dniData?.nombre ? `${dniData.nombre} ${dniData.apellido}` : (userData?.user_metadata?.full_name || 'Ciudadano');
    const curp = dniData?.curp || 'S/R';
    const address = dniData?.domicilio || 'Domicilio Desconocido';
    const birthDate = dniData?.fecha_nacimiento || 'N/A';
    const registerDate = new Date(userData?.created_at || Date.now()).toLocaleDateString('es-MX', { year: 'numeric' });
    const section = "0520"; // Static for now

    // Stamps Logic: Check if user voted in specific years
    // This is a mock logic. In real implementation, we'd check `votes` array for specific election dates.
    // For now, if they have ANY votes, we'll stamp "2026".
    const hasVoted2026 = votes?.length > 0;

    return (
        <div className="perspective-1000 w-[600px] h-[350px] cursor-pointer group" onClick={() => setIsFlipped(!isFlipped)}>
            <div className={`relative w-full h-full transition-transform duration-700 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>

                {/* === FRONT SIDE === */}
                <div className="absolute w-full h-full backface-hidden rounded-xl overflow-hidden shadow-2xl bg-[#E8E8E8] text-gray-900 border border-gray-300">
                    {/* Background Pattern (Guilloche-ish) */}
                    <div className="absolute inset-0 opacity-10 pointer-events-none"
                        style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #D90F74 1px, transparent 1px)', backgroundSize: '10px 10px' }}>
                    </div>

                    {/* Header */}
                    <div className="h-12 bg-white flex items-center justify-between px-4 border-b-2 border-[#D90F74]">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Logotipo_del_INE_%28M%C3%A9xico%29.svg/1200px-Logotipo_del_INE_%28M%C3%A9xico%29.svg.png" alt="INE Logo" className="h-6" />
                        <span className="font-bold text-[#D90F74] text-sm tracking-widest uppercase">Credencial para Votar</span>
                    </div>

                    {/* Content Grid */}
                    <div className="p-4 flex gap-6 h-[calc(100%-3rem)]">
                        {/* Photo Area */}
                        <div className="flex flex-col gap-2 w-32 shrink-0">
                            <div className="w-32 h-40 bg-gray-200 border-2 border-gray-300 rounded relative overflow-hidden">
                                <img src={userAvatar} alt="User" className="w-full h-full object-cover filter grayscale contrast-125" />
                                {/* Hologram Overlay */}
                                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/30 to-transparent opacity-50 bg-[length:200%_200%] animate-shimmer"></div>
                                <div className="absolute bottom-1 right-1 w-8 h-8 opacity-70">
                                    <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Escudo_Nacional_de_M%C3%A9xico.svg/1200px-Escudo_Nacional_de_M%C3%A9xico.svg.png" alt="Escudo" />
                                </div>
                            </div>
                            <p className="text-[10px] text-center font-bold text-gray-500">CIUDADANO</p>
                        </div>

                        {/* Data Area */}
                        <div className="flex-1 space-y-1">
                            <div className="mb-2">
                                <p className="text-[10px] text-gray-500 font-bold uppercase">Nombre</p>
                                <h2 className="text-xl font-bold text-gray-900 leading-none">{name.toUpperCase()}</h2>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <p className="text-[10px] text-gray-500 font-bold uppercase">Domicilio</p>
                                    <p className="text-xs font-medium leading-tight h-8 overflow-hidden">{address.toUpperCase()}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-gray-500 font-bold uppercase">Fecha de Nacimiento</p>
                                    <p className="text-xs font-medium">{birthDate}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 mt-2">
                                <div>
                                    <p className="text-[10px] text-gray-500 font-bold uppercase">Folio / CURP</p>
                                    <p className="text-xs font-mono font-bold text-gray-700">{curp.toUpperCase()}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-gray-500 font-bold uppercase">Año de Registro</p>
                                    <p className="text-sm font-bold text-[#D90F74]">{registerDate}</p>
                                </div>
                            </div>

                            {/* Bottom Codes */}
                            <div className="absolute bottom-4 left-40 right-4 flex justify-between items-end border-t border-gray-300 pt-1">
                                <div className="text-[8px] font-mono text-gray-400 tracking-wider">
                                    IDMEX{section}1234567890&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;
                                </div>
                                <div className="text-xl font-signature text-black opacity-80 -rotate-3">
                                    {name.split(' ')[0]} {/* Fake Signature */}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* === BACK SIDE === */}
                <div className="absolute w-full h-full backface-hidden rounded-xl overflow-hidden shadow-2xl bg-white border border-gray-300 rotate-y-180 p-4">
                    {/* QR & Legal */}
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-4/5 text-[9px] text-gray-500 text-justify leading-snug">
                            Esta credencial es intransferible y válida únicamente para votar en las elecciones de NacionMX. El titular es responsable de su uso y custodia.
                            <br /><br />
                            <strong>INSTITUTO NACIONAL ELECTORAL</strong>
                        </div>
                        <div className="w-16 h-16 bg-white p-1 border border-gray-200">
                            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(userData?.id || 'invitado')}`} alt="QR" className="w-full h-full" />
                        </div>
                    </div>

                    {/* Voting Stamps Grid */}
                    <div className="border-t-2 border-dashed border-gray-300 pt-2">
                        <p className="text-[10px] font-bold text-gray-500 mb-2 uppercase tracking-wider text-center">Historial de Votación Federal</p>

                        <div className="grid grid-cols-6 gap-2">
                            {/* 2026 Stamp */}
                            <div className={`aspect-square border border-gray-200 rounded-full flex items-center justify-center relative ${hasVoted2026 ? 'bg-pink-50' : 'bg-gray-50'}`}>
                                <span className="text-[9px] text-gray-300 font-bold">2026</span>
                                {hasVoted2026 && (
                                    <div className="absolute inset-0 border-2 border-[#D90F74] rounded-full opacity-80 animate-stamp-scale"
                                        style={{ transform: 'rotate(-15deg)' }}>
                                        <div className="w-full h-full flex items-center justify-center">
                                            <span className="text-[#D90F74] text-[8px] font-black uppercase">VOTÓ</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Future Placeholders */}
                            {[2027, 2028, 2029, 2030, 2031].map(year => (
                                <div key={year} className="aspect-square border border-gray-200 rounded-full flex items-center justify-center bg-gray-50">
                                    <span className="text-[9px] text-gray-300 font-bold">{year}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Fingerprint */}
                    <div className="absolute bottom-4 right-4 w-12 h-16 border border-gray-300 rounded flex items-center justify-center opacity-30">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-8 h-8">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.2-2.858.5-4.171 0-1.352 1.1-2.5 2.5-2.5 1.452 0 2.66.866 3.2 2.153C10 7 11 8 11 8s1-1 .8-1.5c-1.39-4.128-4.13-7-7-7" />
                        </svg>
                    </div>
                </div>

            </div>

            {/* Instruction tooltip */}
            <div className="absolute -bottom-8 w-full text-center text-gray-400 text-xs animate-pulse">
                Click para girar
            </div>

            <style>{`
                .perspective-1000 { perspective: 1000px; }
                .transform-style-3d { transform-style: preserve-3d; }
                .backface-hidden { backface-visibility: hidden; }
                .rotate-y-180 { transform: rotateY(180deg); }
                @keyframes shimmer {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }
                .font-signature { font-family: 'Brush Script MT', cursive; }
                @keyframes stamp-scale {
                    0% { transform: scale(3) rotate(0deg); opacity: 0; }
                    100% { transform: scale(1) rotate(-15deg); opacity: 0.8; }
                }
                .animate-stamp-scale { animation: stamp-scale 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
            `}</style>
        </div>
    );
};

export default DigitalID;
