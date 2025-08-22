class CreateInterviewQuestions < ActiveRecord::Migration[8.0]
  def change
    create_table :interview_questions do |t|
      t.text :content

      t.timestamps
    end
  end
end
