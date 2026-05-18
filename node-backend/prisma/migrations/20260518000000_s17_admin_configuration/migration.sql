-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "assigned_doctor_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");

-- CreateIndex
CREATE UNIQUE INDEX "departments_assigned_doctor_user_id_key" ON "departments"("assigned_doctor_user_id");

-- CreateIndex
CREATE INDEX "idx_departments_name" ON "departments"("name");

-- CreateIndex
CREATE INDEX "idx_departments_assigned_doctor_user_id" ON "departments"("assigned_doctor_user_id");

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_assigned_doctor_user_id_fkey" FOREIGN KEY ("assigned_doctor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
