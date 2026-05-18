import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  apiErrorResponse,
  authSuccessResponse,
  renderApp,
} from '@/tests/test-utils/render-app';

const fetchMock = vi.fn<typeof fetch>();

describe('admin configuration page integration', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    window.sessionStorage.clear();
  });

  it('lets admins create a department and assign a doctor through the live workspace', async () => {
    fetchMock
      .mockResolvedValueOnce(
        authSuccessResponse({
          accessToken: 'admin-token',
          role: 'admin',
          userId: 'user-admin',
          username: 'admin',
        }),
      )
      .mockResolvedValueOnce(listDepartmentsResponse([]))
      .mockResolvedValueOnce(createDepartmentResponse())
      .mockResolvedValueOnce(listDepartmentsResponse([createdDepartment()]))
      .mockResolvedValueOnce(assignDoctorResponse())
      .mockResolvedValueOnce(listDepartmentsResponse([assignedDepartment()]));

    const user = userEvent.setup();
    renderApp({ initialEntries: ['/login'] });

    await user.type(screen.getByTestId('username-input'), 'admin');
    await user.type(screen.getByTestId('password-input'), 'secret123');
    await user.click(screen.getByTestId('login-submit-button'));

    expect(await screen.findByTestId('admin-overview-page')).toBeInTheDocument();
    const emptyState = await screen.findByTestId('admin-overview-empty-state');
    expect(emptyState).toHaveAttribute('data-screen-code', 'EMPTY');
    expect(emptyState).toHaveAttribute('data-screen-status', 'empty');

    await user.type(screen.getByTestId('admin-department-name-input'), 'Cardiology');
    await user.click(screen.getByTestId('admin-create-department-submit-button'));

    const createdState = await screen.findByTestId('admin-overview-success-state');
    expect(createdState).toHaveAttribute('data-screen-code', 'DEPARTMENT_CREATED');
    expect(createdState).toHaveAttribute('data-department-id', 'department-cardiology');
    expect(createdState).toHaveAttribute('data-department-name', 'Cardiology');
    expect(createdState).toHaveAttribute('data-assignment-count', '0');

    const departmentCard = await screen.findByTestId('admin-department-card-department-cardiology');
    expect(departmentCard).toHaveAttribute('data-department-id', 'department-cardiology');
    expect(departmentCard).toHaveAttribute('data-assignment-count', '0');
    expect(screen.getByTestId('admin-overview-ready-state')).toHaveAttribute('data-screen-code', 'READY');
    expect(screen.getByTestId('admin-overview-ready-state')).toHaveAttribute('data-screen-status', 'ready');

    await user.selectOptions(screen.getByTestId('admin-department-select'), 'department-cardiology');
    await user.type(screen.getByTestId('admin-doctor-user-id-input'), 'doctor-1');
    await user.click(screen.getByTestId('admin-assign-doctor-submit-button'));

    const assignedState = await screen.findByTestId('admin-overview-success-state');
    expect(assignedState).toHaveAttribute('data-screen-code', 'DOCTOR_ASSIGNED');
    expect(assignedState).toHaveAttribute('data-department-id', 'department-cardiology');
    expect(assignedState).toHaveAttribute('data-department-name', 'Cardiology');
    expect(assignedState).toHaveAttribute('data-assigned-doctor-id', 'doctor-1');
    expect(assignedState).toHaveAttribute('data-assigned-doctor-username', 'doctor.alex');
    expect(assignedState).toHaveAttribute('data-assignment-count', '1');

    await waitFor(() => {
      expect(screen.getByTestId('admin-department-card-department-cardiology')).toHaveAttribute(
        'data-assigned-doctor-id',
        'doctor-1',
      );
      expect(screen.getByTestId('admin-department-card-department-cardiology')).toHaveAttribute(
        'data-assigned-doctor-username',
        'doctor.alex',
      );
    });
    expect(screen.getByTestId('admin-department-assigned-doctor-department-cardiology')).toHaveTextContent('doctor.alex');

    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(fetchMock.mock.calls[1]?.[0]).toBe('http://localhost:3000/api/v1/admin/config/departments');
    expect(fetchMock.mock.calls[2]?.[0]).toBe('http://localhost:3000/api/v1/admin/config/departments');
    expect(fetchMock.mock.calls[4]?.[0]).toBe(
      'http://localhost:3000/api/v1/admin/config/departments/department-cardiology/doctor-assignment',
    );

    const createBody = JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body));
    const assignBody = JSON.parse(String(fetchMock.mock.calls[4]?.[1]?.body));
    expect(createBody).toEqual({ name: 'Cardiology' });
    expect(assignBody).toEqual({ doctorUserId: 'doctor-1' });
  });

  it('blocks blank inputs with validation states before any mutation runs', async () => {
    fetchMock
      .mockResolvedValueOnce(
        authSuccessResponse({
          accessToken: 'admin-token',
          role: 'admin',
          userId: 'user-admin',
          username: 'admin',
        }),
      )
      .mockResolvedValueOnce(listDepartmentsResponse([]));

    const user = userEvent.setup();
    renderApp({ initialEntries: ['/login'] });

    await user.type(screen.getByTestId('username-input'), 'admin');
    await user.type(screen.getByTestId('password-input'), 'secret123');
    await user.click(screen.getByTestId('login-submit-button'));

    await screen.findByTestId('admin-overview-empty-state');
    await user.click(screen.getByTestId('admin-create-department-submit-button'));

    const validationState = await screen.findByTestId('admin-overview-validation-state');
    expect(validationState).toHaveAttribute('data-screen-code', 'INVALID_FORM');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps the workspace fail closed when the admin config API is unavailable', async () => {
    fetchMock
      .mockResolvedValueOnce(
        authSuccessResponse({
          accessToken: 'admin-token',
          role: 'admin',
          userId: 'user-admin',
          username: 'admin',
        }),
      )
      .mockResolvedValueOnce(apiErrorResponse(503, 'OPD_UNAVAILABLE', 'Department store unavailable.'));

    const user = userEvent.setup();
    renderApp({ initialEntries: ['/login'] });

    await user.type(screen.getByTestId('username-input'), 'admin');
    await user.type(screen.getByTestId('password-input'), 'secret123');
    await user.click(screen.getByTestId('login-submit-button'));

    const unavailableState = await screen.findByTestId('admin-overview-unavailable-state');
    expect(unavailableState).toHaveAttribute('data-screen-code', 'UNAVAILABLE');
    expect(unavailableState).toHaveAttribute('data-screen-status', 'unavailable');
    expect(screen.queryByTestId('admin-department-create-form')).not.toBeInTheDocument();
  });

  it('treats malformed department payloads as unavailable instead of rendering optimistic controls', async () => {
    fetchMock
      .mockResolvedValueOnce(
        authSuccessResponse({
          accessToken: 'admin-token',
          role: 'admin',
          userId: 'user-admin',
          username: 'admin',
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: [
              {
                id: 'department-cardiology',
                name: 'Cardiology',
                assignmentCount: 1,
                assignedDoctor: { id: 'doctor-1' },
                createdAt: '2026-05-18T01:00:00.000Z',
                updatedAt: '2026-05-18T01:10:00.000Z',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    const user = userEvent.setup();
    renderApp({ initialEntries: ['/login'] });

    await user.type(screen.getByTestId('username-input'), 'admin');
    await user.type(screen.getByTestId('password-input'), 'secret123');
    await user.click(screen.getByTestId('login-submit-button'));

    const unavailableState = await screen.findByTestId('admin-overview-unavailable-state');
    expect(unavailableState).toHaveAttribute('data-screen-code', 'UNAVAILABLE');
    expect(unavailableState).toHaveAttribute('data-screen-status', 'unavailable');
  });
});

function createdDepartment() {
  return {
    id: 'department-cardiology',
    name: 'Cardiology',
    assignmentCount: 0,
    assignedDoctor: null,
    createdAt: '2026-05-18T01:00:00.000Z',
    updatedAt: '2026-05-18T01:00:00.000Z',
  };
}

function assignedDepartment() {
  return {
    ...createdDepartment(),
    assignmentCount: 1,
    assignedDoctor: {
      id: 'doctor-1',
      username: 'doctor.alex',
    },
    updatedAt: '2026-05-18T01:10:00.000Z',
  };
}

function listDepartmentsResponse(data: Array<ReturnType<typeof createdDepartment> | ReturnType<typeof assignedDepartment>>) {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function createDepartmentResponse() {
  return new Response(JSON.stringify({ success: true, data: createdDepartment() }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
}

function assignDoctorResponse() {
  return new Response(JSON.stringify({ success: true, data: assignedDepartment() }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
