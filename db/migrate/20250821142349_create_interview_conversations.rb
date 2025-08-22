class CreateInterviewConversations < ActiveRecord::Migration[8.0]
  def change
    create_table :interview_conversations do |t|
      t.references :interview_session, null: false, foreign_key: true
      t.text :question
      t.text :answer

      t.timestamps
    end
  end
end
