class CreateInterviewSessions < ActiveRecord::Migration[8.0]
  def change
    create_table :interview_sessions do |t|
      t.string :candidate_name
      t.string :meeting_id
      t.string :status

      t.timestamps
    end
  end
end
