﻿using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Hospital_onco.Models
{
    public class Doctor
    {
        
            public int Id { get; set; }
            public String FirstName { get; set; }
            public String LastName { get; set; }
            public String Description { get; set; }
            public List<Investigation> Investigations { get; set; }
        }
    }

