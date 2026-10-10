export interface TemarioModulo {
  title: string;
  meta: string;
  lessons: string[];
}

export interface Course {
  id?: number | string;
  uuid: string;
  title: string;
  subtitle?: string;
  category?: string;
  image_url?: string;
  instructor?: string;
  duration_hours?: string | number;
  materials_included?: string;
  certification_type?: string;
  modalidad?: string;
  price?: string | number;
  rating?: string | number;
  reviews_count?: string | number;
  students_count?: string | number;
  requisitos?: string | string[];
  beneficios?: string | string[];
  temario?: string | TemarioModulo[];
  created_at?: string;
  updated_at?: string;
}

export interface CourseOption {
  uuid: string;
  title?: string;
  name?: string;
  nombre?: string;
}
