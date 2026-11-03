export type BusinessUnitRecord = {
  id: string;
  organisationId: string;
  name: string;
  code: string;
  departmentCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type DepartmentRecord = {
  id: string;
  businessUnitId: string;
  businessUnitCode: string;
  organisationId: string;
  name: string;
  code: string;
  teamCount: number;
  positionCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type TeamRecord = {
  id: string;
  departmentId: string;
  departmentCode: string;
  businessUnitId: string;
  organisationId: string;
  name: string;
  code: string;
};

export type PositionRecord = {
  id: string;
  departmentId: string;
  departmentCode: string;
  businessUnitId: string;
  organisationId: string;
  title: string;
  code: string;
};
