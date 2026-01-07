const commands = [
    {
        name: 'ping',
        description: 'Comprueba si el bot está vivo'
    },
    {
        name: 'fichar',
        description: 'Inicia o Termina tu turno - Entrada/Salida',
        options: [
            {
                name: 'vincular',
                description: 'Vincular ciudadano al sistema - Solo Bancarios',
                type: 1, // SUB_COMMAND
                options: [
                    { name: 'usuario', description: 'Usuario de Discord a vincular', type: 6, required: true },
                    { name: 'nombre', description: 'Nombre y Apellido RP', type: 3, required: true },
                    { name: 'dni', description: 'Foto del DNI (Opcional si ya está registrado)', type: 11, required: false }
                ]
            }
        ]
    },
    {
        name: 'ayuda',
        description: 'Muestra los comandos bancarios disponibles - Cheat Sheet'
    },

    {
        name: 'registrar-tarjeta',
        description: 'Registrar nueva tarjeta - Staff Banco',
        options: [
            { name: 'usuario', description: 'Usuario de Discord', type: 6, required: true },
            { name: 'nombre_titular', description: 'Nombre completo del titular RP', type: 3, required: true },
            {
                name: 'tipo',
                description: 'Nivel de la tarjeta',
                type: 3,
                required: true,
                choices: [
                    { name: '💳 NMX Débito ($100)', value: 'NMX Débito' },
                    { name: '💳 NMX Débito Plus ($500)', value: 'NMX Débito Plus' },
                    { name: '💳 NMX Débito Gold ($1k)', value: 'NMX Débito Gold' },
                    { name: '--- CRÉDITO ---', value: 'separator_credit' },
                    { name: '💳 NMX Start ($2k)', value: 'NMX Start' },
                    { name: '💳 NMX Básica ($4k)', value: 'NMX Básica' },
                    { name: '💳 NMX Plus ($6k)', value: 'NMX Plus' },
                    { name: '💳 NMX Plata ($10k)', value: 'NMX Plata' },
                    { name: '💳 NMX Oro ($15k)', value: 'NMX Oro' },
                    { name: '💳 NMX Rubí ($25k)', value: 'NMX Rubí' },
                    { name: '💳 NMX Black ($40k)', value: 'NMX Black' },
                    { name: '💳 NMX Diamante ($60k)', value: 'NMX Diamante' },
                    { name: '💳 NMX Zafiro ($100k)', value: 'NMX Zafiro' },
                    { name: '💳 NMX Platino Elite ($150k)', value: 'NMX Platino Elite' },
                    { name: '--- EMPRESARIAL ---', value: 'separator1' },
                    { name: '💳 NMX Business Start ($50k)', value: 'NMX Business Start' },
                    { name: '💳 NMX Business Gold ($100k)', value: 'NMX Business Gold' },
                    { name: '💳 NMX Business Platinum ($200k)', value: 'NMX Business Platinum' },
                    { name: '💳 NMX Business Elite ($500k)', value: 'NMX Business Elite' },
                    { name: '💳 NMX Corporate ($50k)', value: 'NMX Corporate' },
                    { name: '💳 NMX Corporate Plus ($100k)', value: 'NMX Corporate Plus' },
                    { name: '💳 NMX Enterprise ($200k)', value: 'NMX Enterprise' },
                    { name: '💳 NMX Conglomerate ($350k)', value: 'NMX Conglomerate' },
                    { name: '💳 NMX Supreme ($500k)', value: 'NMX Supreme' }
                ]
            },
            { name: 'foto_dni', description: 'Foto del DNI/Identificación (Opcional si ya está en censo)', type: 11, required: false },
            { name: 'notas', description: 'Notas opcionales', type: 3, required: false }
        ]
    },
    {
        name: 'verificar',
        description: 'Vincular tu cuenta de Discord con Roblox',
        options: [
            { name: 'usuario', description: 'Tu nombre de usuario de Roblox', type: 3, required: true }
        ]
    },
    {
        name: 'tarjeta',
        description: 'Informacion sobre tarjetas disponibles - Catalogo',
        options: [
            {
                name: 'info',
                description: 'Ver el catalogo completo de tarjetas y sus beneficios',
                type: 1
            },
            {
                name: 'ver',
                description: 'Ver detalles de una tarjeta especifica',
                type: 1,
                options: [
                    {
                        name: 'nombre',
                        description: 'Nombre de la tarjeta - Ej NMX Oro',
                        type: 3,
                        required: true,
                        choices: [
                            { name: 'NMX Start', value: 'NMX Start' },
                            { name: 'NMX Básica', value: 'NMX Básica' },
                            { name: 'NMX Plus', value: 'NMX Plus' },
                            { name: 'NMX Plata', value: 'NMX Plata' },
                            { name: 'NMX Oro', value: 'NMX Oro' },
                            { name: 'NMX Rubí', value: 'NMX Rubí' },
                            { name: 'NMX Black', value: 'NMX Black' },
                            { name: 'NMX Diamante', value: 'NMX Diamante' },
                            { name: 'NMX Zafiro', value: 'NMX Zafiro' },
                            { name: 'NMX Platino Elite', value: 'NMX Platino Elite' },
                            { name: '--- EMPRESARIAL ---', value: 'separator_business' },
                            { name: 'NMX Business Start', value: 'NMX Business Start' },
                            { name: 'NMX Business Gold', value: 'NMX Business Gold' },
                            { name: 'NMX Business Platinum', value: 'NMX Business Platinum' },
                            { name: 'NMX Business Elite', value: 'NMX Business Elite' },
                            { name: 'NMX Corporate', value: 'NMX Corporate' },
                            { name: 'NMX Corporate Plus', value: 'NMX Corporate Plus' },
                            { name: 'NMX Enterprise', value: 'NMX Enterprise' },
                            { name: 'NMX Conglomerate', value: 'NMX Conglomerate' },
                            { name: 'NMX Supreme', value: 'NMX Supreme' }
                        ]
                    }
                ]
            }
        ]
    },
    {
        name: 'credito',
        description: 'Gestión de tu tarjeta de crédito NMX',
        options: [
            {
                name: 'estado',
                description: 'Ver tu deuda y estado actual',
                type: 1, // SUB_COMMAND
                options: [
                    {
                        name: 'privado',
                        description: 'Ocultar respuesta - Visible solo para ti',
                        type: 5, // BOOLEAN
                        required: false
                    }
                ]
            },
            {
                name: 'pedir-prestamo',
                description: 'Retira efectivo de tu tarjeta - Se suma a tu deuda',
                type: 1, // SUB_COMMAND
                options: [
                    {
                        name: 'monto',
                        description: 'Cantidad a retirar',
                        type: 10, // NUMBER
                        required: true
                    },
                    {
                        name: 'privado',
                        description: 'Ocultar respuesta - Visible solo para ti',
                        type: 5, // BOOLEAN
                        required: false
                    }
                ]
            },
            {
                name: 'pagar',
                description: 'Abona dinero a tu tarjeta de crédito',
                type: 1, // SUB_COMMAND
                options: [
                    {
                        name: 'monto',
                        description: 'Cantidad a pagar',
                        type: 10, // NUMBER
                        required: true
                    },
                    {
                        name: 'privado',
                        description: 'Ocultar respuesta - Visible solo para ti',
                        type: 5, // BOOLEAN
                        required: false
                    }
                ]
            },
            {
                name: 'buro',
                description: 'Ver tu Score de Buró Financiero',
                type: 1
            },
            {
                name: 'info',
                description: 'Ver detalles del plástico - Titular Nivel Fecha',
                type: 1
            },
            {
                name: 'admin',
                description: 'Herramientas Administrativas - Staff',
                type: 2, // SUB_COMMAND_GROUP
                options: [
                    {
                        name: 'puntos',
                        description: 'Modificar Score de Buró - Staff',
                        type: 1,
                        options: [
                            { name: 'usuario', description: 'Usuario afectado', type: 6, required: true },
                            { name: 'cantidad', description: 'Puntos a sumar o restar con signo -', type: 4, required: true },
                            { name: 'razon', description: 'Motivo del ajuste', type: 3, required: true }
                        ]
                    },
                    {
                        name: 'perdonar',
                        description: 'Perdonar la deuda de un usuario',
                        type: 1,
                        options: [
                            { name: 'usuario', description: 'Usuario de Discord', type: 6, required: true }
                        ]
                    },
                    {
                        name: 'congelar',
                        description: 'Congelar una tarjeta - No podrá usarse',
                        type: 1,
                        options: [
                            { name: 'usuario', description: 'Usuario de Discord', type: 6, required: true },
                            { name: 'tipo', description: 'Tipo: debit, credit, business', type: 3, required: true }
                        ]
                    },
                    {
                        name: 'economia',
                        description: '📊 Ver estadísticas de la economía global (Inflación, Rico, etc)',
                        type: 1
                    },
                    {
                        name: 'descongelar',
                        description: 'Reactivar una tarjeta congelada',
                        type: 1,
                        options: [
                            { name: 'usuario', description: 'Usuario de Discord', type: 6, required: true }
                        ]
                    },
                    {
                        name: 'info',
                        description: 'Ver información completa de un usuario',
                        type: 1,
                        options: [
                            { name: 'usuario', description: 'Usuario de Discord', type: 6, required: true }
                        ]
                    },
                    {
                        name: 'historial',
                        description: 'Ver historial financiero completo y análisis de crédito',
                        type: 1,
                        options: [
                            { name: 'usuario', description: 'Usuario a analizar', type: 6, required: true }
                        ]
                    },
                    {
                        name: 'ofrecer-upgrade',
                        description: 'Enviar oferta de mejora de tarjeta por DM - Requiere buen Score',
                        type: 1,
                        options: [
                            { name: 'usuario', description: 'Cliente a evaluar', type: 6, required: true }
                        ]
                    }
                ]
            },
            {
                name: 'debug',
                description: 'Diagnóstico de cuenta - Usar si fallan comandos',
                type: 1
            }
        ]
    },
    {
        name: 'info',
        description: '🏢 Información pública de Nación MX (creadores, ubicación, reglas)',
        type: 1
    },
    {
        name: 'rol',
        description: 'Gestión de Roles y Sanciones',
        options: [
            {
                name: 'cancelar',
                description: 'Reportar cancelación de rol de un usuario',
                type: 1,
                options: [
                    { name: 'usuario', description: 'Usuario sancionado - Nombre o ID', type: 3, required: true },
                    { name: 'razon', description: 'Motivo de la cancelación', type: 3, required: true },
                    { name: 'ubicacion', description: 'Lugar de los fatti/arresto', type: 3, required: true },
                    { name: 'prueba1', description: 'Evidencia principal - Imagen', type: 11, required: true },
                    { name: 'prueba2', description: 'Evidencia secundaria - Imagen', type: 11 }
                ]
            }
        ]
    },

    {
        name: 'multa',
        description: 'Imponer una multa a un ciudadano - Policía',
        options: [
            { name: 'usuario', description: 'Ciudadano a multar', type: 6, required: true },
            { name: 'monto', description: 'Monto de la multa', type: 10, required: true },
            { name: 'razon', description: 'Motivo de la infracción', type: 3, required: true }
        ]
    },
    {
        name: 'depositar',
        description: 'Depositar efectivo a la cuenta de otro ciudadano (OXXO)',
        options: [
            { name: 'destinatario', description: 'Ciudadano a depositar', type: 6, required: true },
            { name: 'monto', description: 'Cantidad o "todo"', type: 3, required: true },
            { name: 'razon', description: 'Concepto del depósito', type: 3, required: false }
        ]
    },
    {
        name: 'giro',
        description: 'Envío de dinero por paquetería (Tarda 24 horas)',
        options: [
            { name: 'destinatario', description: 'Ciudadano a enviar', type: 6, required: true },
            { name: 'monto', description: 'Cantidad o "todo"', type: 3, required: true }
        ]
    },
    {
        name: 'movimientos',
        description: 'Ver historial de tus últimas transacciones',
        type: 1
    },
    {
        name: 'notificaciones',
        description: 'Activar/Desactivar notificaciones del banco por DM',
        options: [
            { name: 'activo', description: '¿Recibir notificaciones?', type: 5, required: true }
        ]
    },
    {
        name: 'top-morosos',
        description: 'Ranking de usuarios con mayor deuda en tarjetas',
        type: 1
    },
    {
        name: 'top-ricos',
        description: 'Ranking de usuarios con mejor Score Crediticio',
        type: 1
    },
    {
        name: 'licencia',
        description: '🪪 Otorgar licencias oficiales a ciudadanos',
        options: [
            {
                name: 'otorgar',
                description: 'Otorgar una licencia a un ciudadano',
                type: 1,
                options: [
                    {
                        name: 'ciudadano',
                        description: 'Ciudadano que recibirá la licencia',
                        type: 6,
                        required: true
                    },
                    {
                        name: 'tipo',
                        description: 'Tipo de licencia',
                        type: 3,
                        required: true,
                        choices: [
                            { name: '🚗 Licencia de Conducir - $1,200', value: 'conducir' },
                            { name: '🔫 Licencia de Armas Cortas - $1,200', value: 'arma_corta' },
                            { name: '🎯 Licencia de Armas Largas - $1,500 (Requiere Policía)', value: 'arma_larga' }
                        ]
                    }
                ]
            }
        ]
    },
    {
        name: 'tienda',
        description: '🛒 Tienda Premium - Pases, roles y beneficios exclusivos',
        options: [
            {
                name: 'ver',
                description: 'Ver catálogo completo de la tienda',
                type: 1
            },
            {
                name: 'comprar',
                description: 'Comprar un item de la tienda',
                type: 1,
                options: [
                    {
                        name: 'item',
                        description: 'Item a comprar',
                        type: 3,
                        required: true,
                        choices: [
                            { name: '👑 Rol Premium - $4,000,000 (30d)', value: 'premium_role' },
                            { name: '🔫 Armas Pesadas - $320,000 (3d)', value: 'heavy_weapons' },
                            { name: '🏎️ Coche Deportivo - $280,000 (7d)', value: 'sports_car' },
                            { name: '🚓 Armamento SWAT - $120,000 (3d)', value: 'swat_vehicle' },
                            { name: '🛡️ Escolta ANTIROBO - $60,000 (7d)', value: 'anti_rob' },
                            { name: '🎨 Sticker Personalizado - $350,000 (permanente)', value: 'custom_sticker' },
                            { name: '🎰 Casino - $600,000 (1h)', value: 'casino_access' },
                            { name: '💚 Anti CK Seguro - $700,000 (3d, 1 uso)', value: 'anti_ck' },
                            { name: '🚗 Vehículo Undercover - $100,000 (3d)', value: 'undercover_vehicle' },
                            { name: '💸 Evasión Impuestos - $380,000 (7d)', value: 'tax_evasion' },
                            { name: '📸 Fotos y Pantalla - $150,000 (7d)', value: 'content_creator' }
                        ]
                    }
                ]
            },
            {
                name: 'mispases',
                description: 'Ver tus pases activos',
                type: 1
            }
        ]
    },
    {
        name: 'inversion',
        description: 'Sistema de Inversión a Plazo Fijo',
        options: [
            {
                name: 'nueva',
                description: 'Abrir una nueva inversión - 7 días con 5% rendimiento',
                type: 1,
                options: [
                    { name: 'monto', description: 'Cantidad a bloquear', type: 10, required: true }
                ]
            },
            {
                name: 'estado',
                description: 'Ver mis inversiones activas y retirar ganancias',
                type: 1
            }
        ]
    },
    {
        name: 'impuestos',
        description: 'Consulta tu estado fiscal con el SAT',
        type: 1
    },
    {
        name: 'empresa',
        description: '🏢 Gestión de empresas y negocios',
        options: [
            {
                name: 'crear',
                description: 'Registrar una nueva empresa ($250k trámite + local + vehículos)',
                type: 1,
                options: [
                    { name: 'nombre', description: 'Nombre legal de la empresa (único)', type: 3, required: true },
                    { name: 'dueño', description: 'Dueño y responsable legal', type: 6, required: true },
                    { name: 'logo', description: 'Logo de la empresa', type: 11, required: true },
                    { name: 'discord_server', description: 'Enlace del servidor de Discord', type: 3, required: true },
                    {
                        name: 'tipo_local',
                        description: 'Tamaño del local/propiedad',
                        type: 3,
                        required: false,
                        choices: [
                            { name: 'Pequeño ($850k)', value: 'pequeño' },
                            { name: 'Mediano ($1.75M)', value: 'mediano' },
                            { name: 'Grande ($3.2M)', value: 'grande' },
                            { name: 'Gigante ($5M)', value: 'gigante' }
                        ]
                    },
                    { name: 'foto_local', description: 'Foto del local/establecimiento (Opcional)', type: 11, required: false },
                    { name: 'ubicacion', description: 'Ubicación RP del negocio', type: 3, required: false },
                    { name: 'co_dueño', description: 'Co-Dueño (Máx. 1)', type: 6, required: false },
                    {
                        name: 'es_privada',
                        description: '¿Es empresa privada? (Sí = más impuestos)',
                        type: 5,
                        required: false
                    }
                ]
            },
            {
                name: 'menu',
                description: 'Panel de gestión de tu empresa',
                type: 1
            },
            {
                name: 'cobrar',
                description: 'Generar cobro para clientes (Terminal POS)',
                type: 1,
                options: [
                    { name: 'cliente', description: 'Cliente a cobrar', type: 6, required: true },
                    { name: 'monto', description: 'Monto a cobrar', type: 10, required: true },
                    { name: 'razon', description: 'Concepto del cobro', type: 3, required: true }
                ]
            },
            {
                name: 'credito',
                description: 'Solicitar crédito empresarial',
                type: 1,
                options: [
                    { name: 'monto', description: 'Cantidad a solicitar', type: 10, required: true },
                    { name: 'razon', description: 'Uso del crédito', type: 3, required: false }
                ]
            },
            {
                name: 'credito-pagar',
                description: 'Pagar deuda de tarjeta empresarial',
                type: 1,
                options: [
                    { name: 'monto', description: 'Cantidad a pagar', type: 10, required: true }
                ]
            },
            {
                name: 'credito-info',
                description: 'Ver estado de crédito empresarial',
                type: 1
            },
            {
                name: 'listar-usuario',
                description: '👮 Ver empresas de un usuario (STAFF ONLY)',
                type: 1,
                options: [
                    { name: 'usuario', description: 'Usuario a investigar', type: 6, required: true }
                ]
            },
            {
                name: 'contratar',
                description: 'Contratar a un empleado para tu empresa',
                type: 1,
                options: [
                    { name: 'usuario', description: 'Usuario a contratar', type: 6, required: true },
                    { name: 'sueldo', description: 'Sueldo semanal', type: 10, required: true },
                    { name: 'puesto', description: 'Puesto/Cargo', type: 3, required: false }
                ]
            },
            {
                name: 'despedir',
                description: 'Despedir a un empleado de tu empresa',
                type: 1,
                options: [
                    { name: 'usuario', description: 'Usuario a despedir', type: 6, required: true }
                ]
            },
            {
                name: 'empleados',
                description: 'Ver lista de empleados de tu empresa',
                type: 1
            },
            {
                name: 'agregar-vehiculo',
                description: 'STAFF: Agregar vehículo a una empresa',
                type: 1,
                options: [
                    { name: 'empresa_usuario', description: 'Dueño de la empresa', type: 6, required: true },
                    { name: 'modelo', description: 'Modelo del vehículo (ej. Tsuru)', type: 3, required: true },
                    { name: 'placa', description: 'Placa del vehículo', type: 3, required: true }
                ]
            }
        ]
    },
    {
        name: 'robar',
        description: '🔫 Intentar robar a un ciudadano (Riesgo de multa/cárcel)',
        options: [
            { name: 'usuario', description: 'Víctima del robo', type: 6, required: true }
        ]
    },
    {
        name: 'trabajar',
        description: '👷 Realizar un trabajo rápido para ganar dinero legal',
        type: 1
    },
    {
        name: 'bolsa',
        description: '📈 Mercado de Valores (Acciones dinámicas)',
        options: [
            {
                name: 'ver',
                description: 'Ver precios actuales de acciones',
                type: 1
            },
            {
                name: 'comprar',
                description: 'Comprar acciones',
                type: 1,
                options: [
                    { name: 'empresa', description: 'Ticker (ej. NMX)', type: 3, required: true },
                    { name: 'cantidad', description: 'Número de acciones', type: 10, required: true }
                ]
            },
            {
                name: 'vender',
                description: 'Vender acciones',
                type: 1,
                options: [
                    { name: 'empresa', description: 'Ticker (ej. NMX)', type: 3, required: true },
                    { name: 'cantidad', description: 'Número de acciones', type: 10, required: true }
                ]
            },
            {
                name: 'portafolio',
                description: 'Ver mis inversiones en bolsa',
                type: 1
            }
        ]
    },
    {
        name: 'crimen',
        description: '🔫 Cometer crímenes de alto riesgo (Ganancias $10k - $100k)',
        type: 1
    },
    {
        name: 'casino',
        description: '🎰 Juegos de Azar (Blackjack, Ruleta)',
        options: [
            {
                name: 'blackjack',
                description: 'Jugar 21 contra la casa',
                type: 1,
                options: [{ name: 'apuesta', description: 'Monto a apostar', type: 10, required: true }]
            },
            {
                name: 'ruleta',
                description: 'Apostar a la ruleta',
                type: 1,
                options: [
                    { name: 'apuesta', description: 'Monto', type: 10, required: true },
                    {
                        name: 'opcion',
                        description: 'A qué apostar',
                        type: 3,
                        required: true,
                        choices: [
                            { name: '🔴 Rojo (x2)', value: 'red' },
                            { name: '⚫ Negro (x2)', value: 'black' },
                            { name: '🟢 Verde (x14)', value: 'green' }, // 0
                            { name: '1-18 (x2)', value: 'low' },
                            { name: '19-36 (x2)', value: 'high' }
                        ]
                    }
                ]
            },
            {
                name: 'fichas',
                description: 'Comprar o vender fichas del casino',
                type: 1,
                options: [
                    {
                        name: 'accion',
                        description: 'Comprar o vender',
                        type: 3,
                        required: true,
                        choices: [
                            { name: '💰 Comprar Fichas', value: 'comprar' },
                            { name: '💵 Vender Fichas', value: 'vender' }
                        ]
                    },
                    { name: 'cantidad', description: 'Cantidad de fichas', type: 10, required: true }
                ]

            }
        ]
    },
    {
        name: 'nomina',
        description: 'Gestión de Nóminas para Empresas',
        options: [
            {
                name: 'crear',
                description: 'Crear un nuevo grupo de pago',
                type: 1,
                options: [{ name: 'nombre', description: 'Nombre del grupo como Taller', type: 3, required: true }]
            },
            {
                name: 'agregar',
                description: 'Agregar empleado al grupo',
                type: 1,
                options: [
                    { name: 'grupo', description: 'Nombre del grupo', type: 3, required: true },
                    { name: 'empleado', description: 'Usuario a pagar', type: 6, required: true },
                    { name: 'sueldo', description: 'Monto a pagar', type: 10, required: true }
                ]
            },
            {
                name: 'pagar',
                description: 'Pagar a todos los empleados del grupo',
                type: 1,
                options: [{ name: 'grupo', description: 'Nombre del grupo', type: 3, required: true }]
            }
        ]
    },
    {
        name: 'dar-robo',
        description: '💰 [Staff] Distribuir dinero de robo (25% en efectivo)',
        options: [
            {
                name: 'usuario',
                description: 'Usuario que recibirá el dinero',
                type: 6,
                required: true
            },
            {
                name: 'monto',
                description: 'Monto total del robo',
                type: 4,
                required: true,
                min_value: 1
            }
        ]
    },
    {
        name: 'stake',
        description: '🔒 Staking de crypto para ingresos pasivos',
        options: [
            {
                name: 'depositar',
                description: 'Stakear crypto por un período fijo',
                type: 1,
                options: [
                    { name: 'crypto', description: 'BTC, ETH o SOL', type: 3, required: true },
                    { name: 'cantidad', description: 'Cantidad a stakear', type: 10, required: true },
                    { name: 'dias', description: '7, 30 o 90 días', type: 4, required: true }
                ]
            },
            {
                name: 'mis-stakes',
                description: 'Ver tus stakes activos',
                type: 1
            },
            {
                name: 'retirar',
                description: 'Retirar un stake desbloqueado',
                type: 1,
                options: [
                    { name: 'id', description: 'ID del stake (primeros 8 caracteres)', type: 3, required: true }
                ]
            }
        ]
    },
    {
        name: 'slots',
        description: '🎰 Tragamonedas con jackpot progresivo',
        options: [
            { name: 'apuesta', description: 'Cantidad a apostar (mín $100)', type: 4, required: true, min_value: 100 }
        ]
    },
    {
        name: 'fondos',
        description: '💼 Fondos de inversión - Set & Forget',
        options: [
            {
                name: 'ver',
                description: 'Ver fondos disponibles',
                type: 1
            },
            {
                name: 'invertir',
                description: 'Invertir en un fondo',
                type: 1,
                options: [
                    { name: 'fondo', description: 'Conservador, Balanceado o Agresivo', type: 3, required: true },
                    { name: 'monto', description: 'Cantidad a invertir', type: 4, required: true }
                ]
            },
            {
                name: 'mis-fondos',
                description: 'Ver mis inversiones',
                type: 1
            }
        ]
    },
    {
        name: 'balanza',
        description: '💰 Ver tu patrimonio total (Efectivo + Banco + Crédito)',
        type: 1
    },
    {
        name: 'rango',
        description: '⚙️ Gestión de Rangos de Staff',
        options: [
            {
                name: 'promover',
                description: 'Subir de rango a un miembro del staff',
                type: 1,
                options: [
                    { name: 'usuario', description: 'Usuario a promover', type: 6, required: true }
                ]
            },
            {
                name: 'degradar',
                description: 'Bajar de rango a un miembro del staff',
                type: 1,
                options: [
                    { name: 'usuario', description: 'Usuario a degradar', type: 6, required: true }
                ]
            },
            {
                name: 'establecer',
                description: 'Asignar un rango específico',
                type: 1,
                options: [
                    { name: 'usuario', description: 'Usuario', type: 6, required: true },
                    {
                        name: 'nivel',
                        description: 'Nuevo rango',
                        type: 3,
                        required: true,
                        choices: [
                            { name: 'Nivel 1: Staff en Entrenamiento', value: '1' },
                            { name: 'Nivel 2: Moderador / Staff', value: '2' },
                            { name: 'Nivel 3: Administración', value: '3' },
                            { name: 'Nivel 4: Junta Directiva', value: '4' }
                        ]
                    }
                ]
            },
            {
                name: 'expulsar',
                description: '🚨 Expulsar miembro del Staff (Wipe completo)',
                type: 1,
                options: [
                    { name: 'usuario', description: 'Usuario a expulsar', type: 6, required: true },
                    { name: 'razon', description: 'Razón de la expulsión', type: 3, required: true }
                ]
            }
        ]
    },
    {
        name: 'agregar-rol',
        description: '➕ Agregar un rol a un usuario (Solo Staff)',
        options: [
            { name: 'usuario', description: 'Usuario al que agregar rol', type: 6, required: true },
            { name: 'rol', description: 'Rol a agregar', type: 8, required: true },
            { name: 'razon', description: 'Razón del cambio', type: 3, required: false }
        ]
    },
    {
        name: 'quitar-rol',
        description: '➖ Quitar un rol de un usuario (Solo Staff)',
        options: [
            { name: 'usuario', description: 'Usuario al que quitar rol', type: 6, required: true },
            { name: 'rol', description: 'Rol a quitar', type: 8, required: true },
            { name: 'razon', description: 'Razón del cambio', type: 3, required: false }
        ]
    },
    {
        name: 'saldo',
        description: '🏦 Ver saldo de banco y efectivo',
        options: [
            { name: 'usuario', description: 'Usuario a consultar (Opcional)', type: 6, required: false }
        ]
    },
    {
        name: 'jugar',
        description: '🎲 Juegos de Apuestas Rápidas',
        options: [
            {
                name: 'slots',
                description: '🎰 Jugar Tragamonedas',
                type: 1,
                options: [
                    { name: 'apuesta', description: 'Cantidad a apostar', type: 4, required: true }
                ]
            },
            {
                name: 'dice',
                description: '🎲 Dados - Alto, Bajo, Par, Impar',
                type: 1,
                options: [
                    { name: 'apuesta', description: 'Cantidad a apostar', type: 4, required: true },
                    {
                        name: 'tipo',
                        description: 'Tu predicción',
                        type: 3,
                        required: true,
                        choices: [
                            { name: 'Mayor a 7', value: 'alto' },
                            { name: 'Menor a 7', value: 'bajo' },
                            { name: 'Par', value: 'par' },
                            { name: 'Impar', value: 'impar' },
                            { name: 'Siete (x4)', value: 'siete' }
                        ]
                    }
                ]
            },
            {
                name: 'ruleta',
                description: '🎯 Ruleta (Rojo/Negro/Verde)',
                type: 1,
                options: [
                    { name: 'apuesta', description: 'Cantidad', type: 4, required: true },
                    {
                        name: 'color', description: 'Color', type: 3, required: true, choices: [
                            { name: 'Rojo (x2)', value: 'rojo' },
                            { name: 'Negro (x2)', value: 'negro' },
                            { name: 'Verde (x14)', value: 'verde' }
                        ]
                    }
                ]
            },
            {
                name: 'crash',
                description: '🚀 Crash Game',
                type: 1,
                options: [{ name: 'apuesta', description: 'Cantidad', type: 4, required: true }]
            },
            {
                name: 'caballos',
                description: '🏇 Carreras',
                type: 1,
                options: [
                    { name: 'apuesta', description: 'Cantidad', type: 4, required: true },
                    { name: 'caballo', description: 'Caballo (1-4)', type: 4, required: true, min_value: 1, max_value: 4 }
                ]
            },
            {
                name: 'gallos',
                description: '🐓 Pelea de Gallos',
                type: 1,
                options: [
                    { name: 'apuesta', description: 'Cantidad', type: 4, required: true },
                    {
                        name: 'gallo', description: 'Gallo', type: 3, required: true, choices: [
                            { name: 'Rojo', value: 'rojo' },
                            { name: 'Azul', value: 'azul' }
                        ]
                    }
                ]
            },
            {
                name: 'rusa',
                description: '🔫 Ruleta Rusa',
                type: 1,
                options: [{ name: 'apuesta', description: 'Cantidad', type: 4, required: true }]
            }
        ]
    },
    {
        name: 'business',
        description: '🏢 Gestión de Tarjetas Empresariales (Staff)',
        options: [
            {
                name: 'vincular',
                description: 'Vincular nueva tarjeta business a una empresa',
                type: 1,
                options: [
                    { name: 'dueño', description: 'Usuario dueño de la empresa', type: 6, required: true },
                    {
                        name: 'tipo',
                        description: 'Tipo de tarjeta',
                        type: 3,
                        required: true,
                        choices: [
                            { name: 'Business Start ($50k Lím)', value: 'business_start' },
                            { name: 'Business Gold ($100k Lím)', value: 'business_gold' },
                            { name: 'Business Platinum ($200k Lím)', value: 'business_platinum' },
                            { name: 'Business Elite ($500k Lím)', value: 'business_elite' },
                            { name: 'NMX Corporate ($1M Lím)', value: 'nmx_corporate' }
                        ]
                    }
                ]
            }
        ]
    },
    {
        name: 'debito',
        description: '🏦 Banco: Retirar y Depositar dinero',
        options: [
            {
                name: 'retirar',
                description: 'Sacar dinero del cajero (Banco -> Efectivo)',
                type: 1,
                options: [{ name: 'monto', description: 'Cantidad a retirar', type: 10, required: true }]
            },
            {
                name: 'depositar',
                description: 'Guardar dinero en el banco (Efectivo -> Banco)',
                type: 1,
                options: [{ name: 'monto', description: 'Cantidad a depositar', type: 10, required: true }]
            },
            {
                name: 'estado',
                description: 'Ver tu saldo bancario y número de tarjeta',
                type: 1
            },
            {
                name: 'transferir',
                description: 'Transferir a otro usuario (Banco a Banco, 5 min)',
                type: 1,
                options: [
                    { name: 'destinatario', description: 'Usuario a transferir', type: 6, required: true },
                    { name: 'monto', description: 'Cantidad a transferir', type: 10, required: true },
                    { name: 'concepto', description: 'Concepto de la transferencia', type: 3, required: false }
                ]
            }
        ]
    },

    // PRIVACY ENHANCEMENTS - Add to commands.js
    // Add these new subcommands to /privacidad command

    // Replace the existing /privacidad command with this expanded version
    {
        name: 'privacidad',
        description: '🕶️ Sistema de Privacidad Bancaria',
        options: [
            {
                name: 'activar',
                description: 'Activar protección de privacidad',
                type: 1,
                options: [{
                    name: 'nivel',
                    description: 'Nivel de protección',
                    type: 3,
                    required: true,
                    choices: [
                        { name: '🥉 Básico ($50k/mes)', value: 'basico' },
                        { name: '🥈 VIP ($150k/mes)', value: 'vip' },
                        { name: '🥇 Elite ($500k/mes)', value: 'elite' }
                    ]
                }]
            },
            {
                name: 'trial',
                description: '🎁 3 días gratis de privacidad Básica',
                type: 1
            },
            {
                name: 'desactivar',
                description: 'Desactivar privacidad',
                type: 1
            },
            {
                name: 'estado',
                description: 'Ver tu nivel de privacidad actual',
                type: 1
            },
            {
                name: 'dashboard',
                description: '📊 Ver estadísticas completas',
                type: 1
            },
            {
                name: 'upgrade',
                description: 'Mejorar tu nivel de privacidad',
                type: 1,
                options: [{
                    name: 'nuevo_nivel',
                    description: 'Nuevo nivel',
                    type: 3,
                    required: true,
                    choices: [
                        { name: 'VIP', value: 'vip' },
                        { name: 'Elite', value: 'elite' }
                    ]
                }]
            },
            {
                name: 'boveda',
                description: 'Gestionar bóveda de emergencia (Elite)',
                type: 1,
                options: [
                    {
                        name: 'accion',
                        description: 'Acción',
                        type: 3,
                        required: true,
                        choices: [
                            { name: 'Depositar', value: 'depositar' },
                            { name: 'Retirar', value: 'retirar' },
                            { name: 'Ver', value: 'ver' }
                        ]
                    },
                    { name: 'monto', description: 'Cantidad', type: 10, required: false }
                ]
            },
            {
                name: 'offshore',
                description: 'Configurar nombre offshore (Elite)',
                type: 1,
                options: [{ name: 'nombre', description: 'Nombre falso para transacciones', type: 3, required: true }]
            },
            {
                name: 'panico',
                description: 'Activar modo pánico (Elite)',
                type: 1,
                options: [{ name: 'pin', description: 'PIN de 6 dígitos', type: 3, required: true }]
            },
            {
                name: 'recuperar',
                description: '🔓 Recuperar de modo pánico',
                type: 1,
                options: [{ name: 'pin', description: 'PIN usado al activar', type: 3, required: true }]
            },
            {
                name: 'alertas',
                description: '🔔 Configurar alertas de seguridad',
                type: 1,
                options: [{
                    name: 'estado',
                    description: 'Activar/Desactivar',
                    type: 3,
                    required: true,
                    choices: [
                        { name: 'Activar', value: 'on' },
                        { name: 'Desactivar', value: 'off' }
                    ]
                }]
            },
            {
                name: 'autorenovar',
                description: '♻️ Auto-renovación mensual',
                type: 1,
                options: [{
                    name: 'estado',
                    description: 'Activar/Desactivar',
                    type: 3,
                    required: true,
                    choices: [
                        { name: 'Activar', value: 'on' },
                        { name: 'Desactivar', value: 'off' }
                    ]
                }]
            },
            {
                name: 'viaje',
                description: '✈️ Activar privacidad temporal',
                type: 1,
                options: [{
                    name: 'horas',
                    description: 'Duración en horas (24-72)',
                    type: 4,
                    required: true,
                    min_value: 24,
                    max_value: 72
                }]
            },
            {
                name: 'referir',
                description: '🎁 Referir a un amigo (10% descuento)',
                type: 1,
                options: [{ name: 'usuario', description: 'Usuario a referir', type: 6, required: true }]
            },
            {
                name: 'familia',
                description: '👨‍👩‍👧 Compartir privacidad con familia',
                type: 1,
                options: [
                    {
                        name: 'accion',
                        description: 'Acción',
                        type: 3,
                        required: true,
                        choices: [
                            { name: 'Agregar', value: 'add' },
                            { name: 'Remover', value: 'remove' },
                            { name: 'Ver', value: 'list' }
                        ]
                    },
                    { name: 'miembro', description: 'Miembro familiar', type: 6, required: false }
                ]
            },
            {
                name: 'score',
                description: '📈 Ver tu Privacy Score',
                type: 1
            }
        ]
    },
    {
        name: 'sesion',
        description: '🗳️ Sistema de votaciones para sesiones de rol',
        options: [
            {
                name: 'crear',
                description: 'Crear una votación para abrir el servidor',
                type: 1,
                options: [
                    { name: 'horario', description: 'Horario de inicio (ej: 3, 21:00)', type: 3, required: true },
                    { name: 'minimo', description: 'Votos mínimos necesarios', type: 4, required: false, min_value: 2, max_value: 20 },
                    { name: 'imagen', description: 'URL de imagen personalizada', type: 3, required: false }
                ]
            },
            {
                name: 'cancelar',
                description: 'Cancelar la votación activa',
                type: 1
            },
            {
                name: 'forzar',
                description: '🔒 Abrir servidor sin mínimo de votos (Staff)',
                type: 1
            },
            {
                name: 'cerrar',
                description: '🔒 Cerrar servidor (Staff)',
                type: 1,
                options: [
                    { name: 'razon', description: 'Razón del cierre', type: 3, required: false }
                ]
            },
            {
                name: 'mantenimiento',
                description: '🛠️ Activar modo mantenimiento (Staff)',
                type: 1,
                options: [
                    { name: 'duracion', description: 'Tiempo estimado (ej: 1 hora)', type: 3, required: false },
                    { name: 'razon', description: 'Motivo del mantenimiento', type: 3, required: false }
                ]
            }
        ]
    }
];

module.exports = commands;
