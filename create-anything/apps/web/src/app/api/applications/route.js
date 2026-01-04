import sql from "@/app/api/utils/sql";

// Create new application
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      user_id,
      username,
      email,
      nombre_completo,
      edad,
      pais,
      zona_horaria,
      roblox_username,
      roblox_user_id,
      roblox_avatar_url,
      experiencia_previa,
      tiempo_disponible,
      rango_deseado,
      por_que_unirse,
      fortalezas,
      situacion_ejemplo,
    } = body;

    // Validate required fields
    if (
      !nombre_completo ||
      !edad ||
      !pais ||
      !zona_horaria ||
      !roblox_username ||
      !experiencia_previa ||
      !tiempo_disponible ||
      !rango_deseado ||
      !por_que_unirse ||
      !fortalezas ||
      !situacion_ejemplo
    ) {
      return Response.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const result = await sql`
      INSERT INTO applications (
        user_id,
        username,
        email,
        nombre_completo,
        edad,
        pais,
        zona_horaria,
        roblox_username,
        roblox_user_id,
        roblox_avatar_url,
        experiencia_previa,
        tiempo_disponible,
        rango_deseado,
        por_que_unirse,
        fortalezas,
        situacion_ejemplo,
        status
      ) VALUES (
        ${user_id || null},
        ${username || ""},
        ${email || ""},
        ${nombre_completo},
        ${edad},
        ${pais},
        ${zona_horaria},
        ${roblox_username},
        ${roblox_user_id || null},
        ${roblox_avatar_url || null},
        ${experiencia_previa},
        ${tiempo_disponible},
        ${rango_deseado},
        ${por_que_unirse},
        ${fortalezas},
        ${situacion_ejemplo},
        'pending'
      )
      RETURNING *
    `;

    return Response.json({ application: result[0] }, { status: 201 });
  } catch (error) {
    console.error("Error creating application:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

// List all applications
export async function GET(request) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const search = url.searchParams.get("search");

    let query = "SELECT * FROM applications WHERE 1=1";
    const values = [];
    let paramCount = 0;

    if (status && status !== "all") {
      paramCount++;
      query += ` AND status = $${paramCount}`;
      values.push(status);
    }

    if (search) {
      paramCount++;
      query += ` AND (LOWER(nombre_completo) LIKE LOWER($${paramCount}) OR LOWER(roblox_username) LIKE LOWER($${paramCount}) OR LOWER(email) LIKE LOWER($${paramCount}))`;
      values.push(`%${search}%`);
    }

    query += " ORDER BY created_at DESC";

    const applications = await sql(query, values);

    return Response.json({ applications });
  } catch (error) {
    console.error("Error fetching applications:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
