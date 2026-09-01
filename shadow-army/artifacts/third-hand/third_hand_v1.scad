// Shadow Army — Third Hand v1
// Hard constraint: base footprint <= 150x150 mm
$fn=64;
base_x=140;
base_y=120;
base_h=6;
post_d=18;
post_h=95;
arm_len=85;
arm_w=16;
arm_h=12;
pivot_d=5.2; // M5 clearance
jaw_w=18;
jaw_len=42;
jaw_h=12;

module base(){
 difference(){
  union(){
   cube([base_x,base_y,base_h],center=false);
   translate([25,base_y/2,base_h]) cylinder(d=30,h=8);
  }
  // four M4 mounting holes
  for(x=[10,base_x-10]) for(y=[10,base_y-10])
   translate([x,y,-1]) cylinder(d=4.4,h=base_h+2);
  translate([25,base_y/2,-1]) cylinder(d=post_d+0.5,h=base_h+10);
 }
}

module post(){
 difference(){
  cylinder(d=post_d,h=post_h);
  translate([0,0,post_h-12]) rotate([0,90,0]) cylinder(d=pivot_d,h=post_d+4,center=true);
 }
}

module arm(){
 difference(){
  hull(){
   cylinder(d=arm_w,h=arm_h);
   translate([arm_len,0,0]) cylinder(d=arm_w,h=arm_h);
  }
  translate([0,0,-1]) cylinder(d=pivot_d,h=arm_h+2);
  translate([arm_len,0,-1]) cylinder(d=pivot_d,h=arm_h+2);
 }
}

module jaw(){
 difference(){
  cube([jaw_len,jaw_w,jaw_h]);
  translate([7,-1,4]) cube([jaw_len-14,jaw_w+2,jaw_h]);
  translate([6,jaw_w/2,-1]) cylinder(d=pivot_d,h=jaw_h+2);
 }
}

// Print layout; all components remain inside 140x120 footprint.
base();
translate([25,base_y/2,base_h+8]) post();
translate([45,20,base_h]) arm();
translate([75,85,base_h]) jaw();
