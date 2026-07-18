import { NextRequest, NextResponse } from 'next/server'
import { answerQuestion } from '@/lib/rag'

export async function POST(req: NextRequest) {
  try {
    const { question, documentIds, model } = await req.json()

    if (!question || typeof question !== 'string') {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 })
    }

    const result = await answerQuestion(question, documentIds, model)

    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: 'Chat failed: ' + (err as Error).message }, { status: 500 })
  }
}
