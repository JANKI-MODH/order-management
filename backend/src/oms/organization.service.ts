import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { isForeignKeyViolation, isUniqueViolation } from "../database/pg-error";
import { RecordsService } from "./records.service";

@Injectable()
export class OrganizationService {
  constructor(
    private readonly database: DatabaseService,
    private readonly records: RecordsService,
  ) {}

  async list() {
    const organizations = await this.database.pool.query<{ id: string; name: string }>("SELECT id, name FROM organizations ORDER BY name");
    const teams = await this.database.pool.query<{ id: string; organization_id: string; name: string }>(
      "SELECT id, organization_id, name FROM teams ORDER BY name",
    );
    const members = await this.database.pool.query<{ team_id: string; user_id: string; email: string }>(
      `SELECT tm.team_id, tm.user_id, u.email
       FROM team_members tm
       JOIN users u ON u.id = tm.user_id
       ORDER BY u.email`,
    );
    return organizations.rows.map((organization) => ({
      id: organization.id,
      name: organization.name,
      teams: teams.rows
        .filter((team) => team.organization_id === organization.id)
        .map((team) => ({
          id: team.id,
          name: team.name,
          members: members.rows
            .filter((member) => member.team_id === team.id)
            .map((member) => ({ userId: member.user_id, email: member.email })),
        })),
    }));
  }

  async createOrganization(actorUserId: string, name: string) {
    return this.database.withTransaction(async (client) => {
      try {
        const result = await client.query<{ id: string; name: string }>(
          "INSERT INTO organizations (name) VALUES ($1) RETURNING id, name",
          [name.trim()],
        );
        await this.records.audit(client, actorUserId, "organization.created", "organization", result.rows[0].id);
        return result.rows[0];
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new ConflictException("An organization with this name already exists");
        }
        throw error;
      }
    });
  }

  async createTeam(actorUserId: string, organizationId: string, name: string) {
    return this.database.withTransaction(async (client) => {
      const organization = await client.query("SELECT id FROM organizations WHERE id = $1", [organizationId]);
      if (!organization.rows[0]) {
        throw new NotFoundException("Organization not found");
      }
      try {
        const result = await client.query<{ id: string; name: string }>(
          "INSERT INTO teams (organization_id, name) VALUES ($1, $2) RETURNING id, name",
          [organizationId, name.trim()],
        );
        await this.records.audit(client, actorUserId, "team.created", "team", result.rows[0].id);
        return { id: result.rows[0].id, organizationId, name: result.rows[0].name };
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new ConflictException("This organization already has a team with that name");
        }
        throw error;
      }
    });
  }

  async addMember(actorUserId: string, teamId: string, userId: string) {
    return this.database.withTransaction(async (client) => {
      try {
        await client.query("INSERT INTO team_members (team_id, user_id) VALUES ($1, $2)", [teamId, userId]);
      } catch (error) {
        if (isForeignKeyViolation(error)) {
          throw new NotFoundException("Team or user not found");
        }
        if (isUniqueViolation(error)) {
          throw new ConflictException("That user is already on the team");
        }
        throw error;
      }
      await this.records.audit(client, actorUserId, "team.member_added", "team", teamId);
      return { teamId, userId };
    });
  }
}
