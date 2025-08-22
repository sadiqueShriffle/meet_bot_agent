module Api
  module V1
    class InterviewsController < ApplicationController
      
      # POST /api/v1/interviews/start
      def start
        # session = InterviewSession.create!(
        # candidate_name: params[:candidate_name],
        # meeting_id: params[:meeting_id],
        # status: "ongoing"
        # )
        # Call Node.js bot service
        bot_response = Faraday.post("http://localhost:4000/start-bot", {
          meetingUrl:  params[:meetingUrl],
          sessionId: 5
        }.to_json, "Content-Type" => "application/json")

        render json: { session_id: 5, bot: JSON.parse(bot_response.body) }
      end

      # GET /api/v1/interviews/:id/next_question
      def next_question
        session = InterviewSession.find(params[:id])
        answered_questions = session.interview_conversations.pluck(:question)
        
        question = InterviewQuestion.where.not(content: answered_questions).sample
        render json: { question: question&.content }
      end

      # POST /api/v1/interviews/:id/answer
      def answer
        session = InterviewSession.find(params[:id])
        
        conv = session.interview_conversations.create!(
          question: params[:question],
          answer: params[:answer]
        )
        
        render json: { saved: true, conversation_id: conv.id }
      end

      # GET /api/v1/interviews/:id/transcript
      def transcript
        session = InterviewSession.find(params[:id])
        render json: session.interview_conversations.select(:question, :answer)
      end
    end
  end
end
