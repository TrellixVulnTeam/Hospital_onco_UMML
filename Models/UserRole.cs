﻿using Microsoft.AspNetCore.Identity;
using System.ComponentModel.DataAnnotations;

namespace Hospital_onco.Models
{
    public class UserRole : IdentityRole
    {
        public const string ROLE_ADMIN = "AppAdmin";
        public const string ROLE_USER = "AppUser";

        [Required]
        public override string Name { get; set; } = ROLE_USER;
	}
}
