// utils/config-negocio.js - VERSIÓN MULTI-TENANT CORREGIDA
// CLIENTE: Knela nails art

console.log('🏢 config-negocio.js cargado');

// ============================================
// 🔥 CONFIGURACIÓN POR CLIENTE - ¡LO ÚNICO QUE CAMBIA!
// ============================================
const NEGOCIO_ID_POR_DEFECTO = '8fd7007b-12a5-4ed4-88cc-b9c84b75a6e3'; // ID de Knela nails art

// Hacer accesible globalmente
window.NEGOCIO_ID_POR_DEFECTO = NEGOCIO_ID_POR_DEFECTO;

// ============================================
// FUNCIONES PARA OBTENER EL ID (GLOBALES)
// ============================================
window.getNegocioId = function() {
    return NEGOCIO_ID_POR_DEFECTO;
};

window.getNegocioIdFromConfig = function() {
    return NEGOCIO_ID_POR_DEFECTO;
};

// Cache de configuración
let configCache = null;
let ultimaActualizacion = 0;
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutos

function normalizarHexColor(hex, fallback = '#ec4899') {
    const limpio = String(hex || '').replace('#', '').trim();
    if (!/^[0-9a-fA-F]{6}$/.test(limpio)) return fallback;
    return `#${limpio}`;
}

function getRgbFromHex(hex, fallback = { r: 236, g: 72, b: 153 }) {
    const limpio = String(hex || '').replace('#', '').trim();
    if (!/^[0-9a-fA-F]{6}$/.test(limpio)) return fallback;
    return {
        r: parseInt(limpio.slice(0, 2), 16),
        g: parseInt(limpio.slice(2, 4), 16),
        b: parseInt(limpio.slice(4, 6), 16)
    };
}

function getLuminancia(rgb) {
    const canales = [rgb.r, rgb.g, rgb.b].map(valor => {
        const normal = valor / 255;
        return normal <= 0.03928
            ? normal / 12.92
            : Math.pow((normal + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * canales[0] + 0.7152 * canales[1] + 0.0722 * canales[2];
}

function oscurecerHex(hex, factor = 0.62) {
    const rgb = getRgbFromHex(hex);
    const toHex = valor => Math.max(0, Math.min(255, Math.round(valor))).toString(16).padStart(2, '0');
    return `#${toHex(rgb.r * factor)}${toHex(rgb.g * factor)}${toHex(rgb.b * factor)}`;
}

function asegurarColorVisible(hex, fallback = '#ec4899') {
    const normalizado = normalizarHexColor(hex, fallback);
    const rgb = getRgbFromHex(normalizado);
    return getLuminancia(rgb) > 0.72 ? oscurecerHex(normalizado) : normalizado;
}

function hexToRgbParts(hex, fallback = '236 72 153') {
    const limpio = String(hex || '').replace('#', '').trim();
    if (!/^[0-9a-fA-F]{6}$/.test(limpio)) return fallback;
    const r = parseInt(limpio.slice(0, 2), 16);
    const g = parseInt(limpio.slice(2, 4), 16);
    const b = parseInt(limpio.slice(4, 6), 16);
    return `${r} ${g} ${b}`;
}

function aplicarTemaNegocio(config = {}) {
    const primarioOriginal = normalizarHexColor(config.color_primario || '#ec4899');
    const secundarioOriginal = normalizarHexColor(config.color_secundario || '#f9a8d4', '#f9a8d4');
    const primario = asegurarColorVisible(primarioOriginal, '#ec4899');
    const secundario = asegurarColorVisible(secundarioOriginal, '#f9a8d4');
    const primarioRgb = hexToRgbParts(primario);
    const secundarioRgb = hexToRgbParts(secundario, '249 168 212');
    const secundarioCss = secundarioRgb.split(' ').join(', ');
    const root = document.documentElement;

    root.style.setProperty('--brand-primary', primario);
    root.style.setProperty('--brand-secondary', secundario);
    root.style.setProperty('--brand-primary-original', primarioOriginal);
    root.style.setProperty('--brand-secondary-original', secundarioOriginal);
    root.style.setProperty('--brand-primary-rgb', primarioRgb);
    root.style.setProperty('--brand-secondary-rgb', secundarioRgb);
    root.style.setProperty('--brand-soft', `rgba(${secundarioCss}, 0.20)`);
    root.style.setProperty('--brand-surface', `rgba(${secundarioCss}, 0.12)`);
    root.style.setProperty('--brand-surface-strong', `rgba(${secundarioCss}, 0.28)`);

    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.setAttribute('content', primario);
}

window.aplicarTemaNegocio = aplicarTemaNegocio;

/**
 * Obtiene el negocio_id propio de este cliente.
 */
function getNegocioId() {
    const localId = localStorage.getItem('negocioId');
    if (localId !== NEGOCIO_ID_POR_DEFECTO) {
        localStorage.setItem('negocioId', NEGOCIO_ID_POR_DEFECTO);
    }
    console.log('📌 Usando negocioId del cliente:', NEGOCIO_ID_POR_DEFECTO);
    return NEGOCIO_ID_POR_DEFECTO;
}

/**
 * Carga la configuración del negocio desde Supabase
 */
window.cargarConfiguracionNegocio = async function(forceRefresh = false) {
    const negocioId = getNegocioId();
    if (!negocioId) {
        console.error('❌ No hay negocioId disponible');
        return null;
    }

    // Usar caché si no se fuerza refresco
    if (!forceRefresh && configCache && (Date.now() - ultimaActualizacion) < CACHE_DURATION) {
        console.log('📦 Usando cache de configuración');
        aplicarTemaNegocio(configCache);
        return configCache;
    }

    try {
        console.log('🌐 Cargando configuración del negocio desde Supabase...');
        console.log('📡 ID del negocio:', negocioId);
        
        const url = `${window.SUPABASE_URL}/rest/v1/negocios?id=eq.${negocioId}&select=*`;
        
        const response = await fetch(url, {
            headers: {
                'apikey': window.SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${window.SUPABASE_ANON_KEY}`,
                'Cache-Control': 'no-cache'
            },
            cache: 'no-store'
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Error response:', errorText);
            return null;
        }

        const data = await response.json();
        
        // Guardar en cache
        configCache = data[0] || null;
        ultimaActualizacion = Date.now();
        
        if (configCache) {
            if (window.setCodigoPaisTelefono) {
                window.setCodigoPaisTelefono(configCache.codigo_pais || configCache.codigo_pais_telefono || '53');
            }
            aplicarTemaNegocio(configCache);
            console.log('✅ Configuración cargada:');
            console.log('   - Nombre:', configCache.nombre);
            console.log('   - Teléfono:', configCache.telefono);
            console.log('   - Email:', configCache.email);
            console.log('   - Instagram:', configCache.instagram);
            console.log('   - Logo:', configCache.logo_url);
            
            // Guardar ID en localStorage para futuras sesiones
            const localId = localStorage.getItem('negocioId');
            if (!localId) {
                console.log('💾 Guardando ID en localStorage');
                localStorage.setItem('negocioId', negocioId);
            }
        } else {
            console.log('⚠️ No se encontró configuración para el negocio');
        }
        
        return configCache;
    } catch (error) {
        console.error('❌ Error cargando configuración:', error);
        return null;
    }
};

/**
 * Obtiene el nombre del negocio
 */
window.getNombreNegocio = async function() {
    const config = await window.cargarConfiguracionNegocio();
    return config?.nombre || 'Knela nails art';
};

/**
 * Obtiene el teléfono del dueño
 */
window.getTelefonoDuenno = async function() {
    const config = await window.cargarConfiguracionNegocio();
    return config?.telefono || '58146272';
};

window.getCodigoPaisNegocio = async function() {
    const config = await window.cargarConfiguracionNegocio();
    return window.getCodigoPaisTelefono ? window.getCodigoPaisTelefono(config) : (config?.codigo_pais || '53');
};

/**
 * Obtiene el email del negocio
 */
window.getEmailNegocio = async function() {
    const config = await window.cargarConfiguracionNegocio();
    return config?.email || 'rodriguezwarnerd@gmail.com';
};

/**
 * Obtiene el Instagram
 */
window.getInstagram = async function() {
    const config = await window.cargarConfiguracionNegocio();
    return config?.instagram || '';
};

/**
 * Obtiene el Facebook
 */
window.getFacebook = async function() {
    const config = await window.cargarConfiguracionNegocio();
    return config?.facebook || '';
};

/**
 * Obtiene el horario de atención
 */
window.getHorarioAtencion = async function() {
    const config = await window.cargarConfiguracionNegocio();
    return config?.horario_atencion || '';
};

/**
 * Obtiene el mensaje de bienvenida
 */
window.getMensajeBienvenida = async function() {
    const config = await window.cargarConfiguracionNegocio();
    return config?.mensaje_bienvenida || '¡Bienvenida a Knela nails art!';
};

/**
 * Obtiene el mensaje de confirmación
 */
window.getMensajeConfirmacion = async function() {
    const config = await window.cargarConfiguracionNegocio();
    return config?.mensaje_confirmacion || 'Tu turno ha sido reservado con éxito';
};

/**
 * Obtiene el tópico de ntfy para notificaciones
 */
window.getNtfyTopic = async function() {
    const config = await window.cargarConfiguracionNegocio();
    return config?.ntfy_topic || 'knelanailsart';
};

/**
 * 🔥 NUEVA FUNCIÓN: Obtiene si el negocio requiere anticipo
 */
window.getRequiereAnticipo = async function() {
    const config = await window.cargarConfiguracionNegocio();
    return config?.requiere_anticipo || false;
};

/**
 * Verifica si el negocio ya está configurado
 */
window.negocioConfigurado = async function() {
    const config = await window.cargarConfiguracionNegocio();
    return config?.configurado || false;
};

// Precargar configuración al inicio
setTimeout(async () => {
    console.log('🔄 Precargando configuración automática...');
    await window.cargarConfiguracionNegocio();
}, 500);

console.log('✅ config-negocio.js listo para Knela nails art');
console.log('🏷️  ID configurado:', NEGOCIO_ID_POR_DEFECTO);
