module Api
  module V1
    require 'securerandom'
    class InterviewsController < ApplicationController
      def index        
      end

      def start
        session_id = SecureRandom.uuid

        begin
          # Calling Node.js bot service
          bot_response = Faraday.post("http://localhost:4000/start-bot") do |req|
            req.headers['Content-Type'] = 'application/json'
            req.body = {
              meetingUrl: params[:meetingUrl],
              sessionId: session_id,
              participantName: params[:candidate_name] || "Interview Participant"
            }.to_json
          end

          render json: { 
            session_id: session_id, 
            bot: JSON.parse(bot_response.body),
            candidate_name: params[:candidate_name],
            meeting_url: params[:meetingUrl]
          }

        rescue Faraday::Error => e
          render json: { 
            error: "Failed to connect to bot service: #{e.message}",
            session_id: session_id
          }, status: 500
        rescue => e
          render json: { 
            error: "Unexpected error: #{e.message}",
            session_id: session_id
          }, status: 500
        end
      end

      def next_question
        session = InterviewSession.find(params[:id])
        answered_questions = session.interview_conversations.pluck(:question)
        
        question = InterviewQuestion.where.not(content: answered_questions).sample
        render json: { question: question&.content }
      end

      def answer
        session = InterviewSession.find(params[:id])
        
        conv = session.interview_conversations.create!(
          question: params[:question],
          answer: params[:answer]
        )
        
        render json: { saved: true, conversation_id: conv.id }
      end

      def transcript
        session = InterviewSession.find(params[:id])
        render json: session.interview_conversations.select(:question, :answer)
      end
    end
  end
end