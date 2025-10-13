/**
 * Initialize Workflow API
 * POST /api/research/workflow/init
 *
 * Initialize workflow for a research question based on its context
 */

interface Env {
  DB: D1Database
}

interface InitWorkflowRequest {
  researchQuestionId: string
  researchContext: 'osint' | 'investigation' | 'business' | 'journalism' | 'academic' | 'personal'
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body = await context.request.json() as InitWorkflowRequest

    if (!body.researchQuestionId || !body.researchContext) {
      return new Response(JSON.stringify({
        error: 'Missing required fields: researchQuestionId, researchContext'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('[init-workflow] Initializing workflow for:', body.researchQuestionId, body.researchContext)

    // Get the workflow template for this context
    const templateResult = await context.env.DB.prepare(`
      SELECT * FROM workflow_templates
      WHERE research_context = ?
      LIMIT 1
    `).bind(body.researchContext).first()

    if (!templateResult) {
      return new Response(JSON.stringify({
        error: `No workflow template found for context: ${body.researchContext}`
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const template = {
      ...templateResult,
      stages: JSON.parse(templateResult.stages as string),
      default_tasks: JSON.parse(templateResult.default_tasks as string),
      evidence_types: JSON.parse(templateResult.evidence_types as string),
      analysis_types: JSON.parse(templateResult.analysis_types as string)
    }

    // Create default tasks from template
    const tasks: any[] = []
    const now = new Date().toISOString()

    for (const defaultTask of template.default_tasks) {
      const taskId = crypto.randomUUID()

      await context.env.DB.prepare(`
        INSERT INTO research_tasks (
          id, research_question_id, workspace_id,
          workflow_stage, task_title, task_description,
          status, priority, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        taskId,
        body.researchQuestionId,
        '1',
        defaultTask.stage,
        defaultTask.title,
        defaultTask.description || null,
        'pending',
        defaultTask.priority || 'medium',
        now
      ).run()

      tasks.push({
        id: taskId,
        researchQuestionId: body.researchQuestionId,
        workflowStage: defaultTask.stage,
        taskTitle: defaultTask.title,
        status: 'pending',
        priority: defaultTask.priority || 'medium',
        createdAt: now
      })
    }

    // Log activity
    const activityId = crypto.randomUUID()
    await context.env.DB.prepare(`
      INSERT INTO research_activity (
        id, research_question_id, workspace_id,
        activity_type, actor, content, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      activityId,
      body.researchQuestionId,
      '1',
      'workflow_initialized',
      'system',
      `Initialized ${template.template_name} workflow with ${tasks.length} tasks`,
      now
    ).run()

    console.log('[init-workflow] Created', tasks.length, 'default tasks')

    return new Response(JSON.stringify({
      success: true,
      workflow: {
        template: template.template_name,
        stages: template.stages,
        evidenceTypes: template.evidence_types,
        analysisTypes: template.analysis_types
      },
      tasks,
      taskCount: tasks.length
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[init-workflow] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to initialize workflow',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  })
}
