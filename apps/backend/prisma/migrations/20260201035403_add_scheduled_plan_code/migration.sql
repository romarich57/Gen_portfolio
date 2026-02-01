-- AlterTable
ALTER TABLE "files" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "scheduled_plan_code" "PlanCode";
