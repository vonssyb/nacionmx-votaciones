import sql from "@/app/api/utils/sql";

// Get single application
export async function GET(request, { params }) {
  try {
    const { id } = params;
    const result = await sql`
      SELECT * FROM applications WHERE id = ${id} LIMIT 1
    `;

    if (result.length === 0) {
      return Response.json({ error: "Application not found" }, { status: 404 });
    }

    return Response.json({ application: result[0] });
  } catch (error) {
    console.error("Error fetching application:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Update application status
export async function PATCH(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const { status, review_notes, reviewed_by } = body;

    if (
      !status ||
      !["pending", "reviewing", "approved", "rejected"].includes(status)
    ) {
      return Response.json({ error: "Invalid status" }, { status: 400 });
    }

    const result = await sql`
      UPDATE applications 
      SET 
        status = ${status},
        review_notes = ${review_notes || null},
        reviewed_by = ${reviewed_by || null},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return Response.json({ error: "Application not found" }, { status: 404 });
    }

    return Response.json({ application: result[0] });
  } catch (error) {
    console.error("Error updating application:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
