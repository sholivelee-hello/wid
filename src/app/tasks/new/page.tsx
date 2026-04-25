import { TaskForm } from '@/components/tasks/task-form';

export default function NewTaskPage() {
  return (
    <div>
      <p className="text-sm text-muted-foreground mb-6">새로운 task의 정보를 입력하세요.</p>
      <TaskForm />
    </div>
  );
}
