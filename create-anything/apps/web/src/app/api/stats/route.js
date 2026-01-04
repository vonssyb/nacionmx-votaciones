import sql from "@/app/api/utils/sql";

export async function GET() {
  try {
    // Get application counts by status
    const counts = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'approved') as approved
      FROM applications
    `;

    const totalApplications = parseInt(counts[0]?.total || 0);
    const approvedCount = parseInt(counts[0]?.approved || 0);
    const approvalRate =
      totalApplications > 0
        ? Math.round((approvedCount / totalApplications) * 100)
        : 0;

    return Response.json({
      totalApplications,
      activeStaff: 47, // Static for now, could be dynamic
      approvalRate,
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return Response.json({
      totalApplications: 0,
      activeStaff: 47,
      approvalRate: 0,
    });
  }
}
