# Mi Horario — cómo ponerlo en línea

Sigue estos pasos en orden. No necesitas saber programar, solo copiar y pegar.

## 1. Crea tu cuenta y proyecto en Supabase (guarda los horarios)

1. Ve a https://supabase.com y crea una cuenta gratis.
2. Crea un proyecto nuevo (te pedirá un nombre y una contraseña de base de datos — guárdala, no la necesitarás seguido).
3. Cuando el proyecto esté listo, ve a **SQL Editor** (menú de la izquierda) → **New query**.
4. Abre el archivo `supabase_setup.sql` de esta carpeta, copia todo su contenido, pégalo ahí, y dale **Run**.
5. Ve a **Settings** (⚙️) → **API**. Ahí vas a ver dos datos que necesitarás en el paso 4:
   - **Project URL**
   - **anon public key**

## 2. Consigue tu clave de la API de Google Gemini (gratis, sin tarjeta)

1. Ve a https://aistudio.google.com/apikey (inicia sesión con tu cuenta de Google).
2. Dale **Create API key**.
3. Elige o crea un proyecto de Google Cloud (es automático, no necesitas configurar nada más).
4. Copia la clave que te da — guárdala en un lugar seguro.

Esto es gratis de verdad: no pide tarjeta y tiene un límite diario de uso generoso (más que suficiente para una app personal o de pocos usuarios).

## 3. Sube el código a GitHub

1. Crea una cuenta en https://github.com si no tienes.
2. Crea un repositorio nuevo (botón verde "New").
3. Sube todos los archivos de esta carpeta a ese repositorio (puedes arrastrarlos directo en la página de GitHub con "uploading an existing file", o usar GitHub Desktop si prefieres algo visual).

## 4. Publícalo con Vercel (aquí es donde queda "en línea")

1. Ve a https://vercel.com y crea una cuenta usando tu cuenta de GitHub (botón "Continue with GitHub").
2. Dale **Add New… → Project**, y elige el repositorio que acabas de subir.
3. Antes de darle "Deploy", abre la sección **Environment Variables** y agrega estas 3, una por una (nombre y valor):

   | Nombre | Valor |
   |---|---|
   | `GEMINI_API_KEY` | tu clave de Google AI Studio del paso 2 |
   | `NEXT_PUBLIC_SUPABASE_URL` | el Project URL de Supabase del paso 1 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | el anon public key de Supabase del paso 1 |

4. Dale **Deploy**. Espera 1-2 minutos.
5. Cuando termine, Vercel te da un link real, algo como `mi-horario.vercel.app` — ese link ya es tu app pública, funcionando con IA de verdad.

## Después de publicarlo

- Cada persona que abra el link tiene su propio horario guardado por separado (se identifica por su navegador, sin necesitar registrarse).
- Si quieres un dominio propio (como `mihorario.com`), lo compras donde quieras (Namecheap, GoDaddy, etc.) y lo conectas en Vercel → tu proyecto → **Settings → Domains**.
- Si algo se ve raro, en Vercel puedes ir a **Deployments → View Function Logs** para ver el error exacto.

## Nota sobre seguridad

Para simplificar, cada persona se identifica por un ID guardado en su propio navegador (no hay contraseñas ni login). Esto significa que si alguien borra los datos de su navegador o cambia de dispositivo, no recupera su horario anterior. Si más adelante quieres que la gente pueda entrar con su correo desde cualquier dispositivo, se le puede agregar autenticación real de Supabase — avísame cuando quieras ese siguiente paso.
